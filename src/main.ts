/**
 * main — application entry point.
 *
 * Wires: World (seeded terrain) + Physics + Player + Input + Renderer + Loop
 * + SaveManager (IndexedDB). All cross-system signals go through the EventBus.
 *
 * Chunk streaming: a fixed radius around the player is kept loaded/meshed,
 * refreshed only when the player crosses a chunk border (cheap check/frame).
 */

import { World } from './world/world';
import { BlockRegistry } from './world/blocks';
import { PhysicsWorld } from './physics/physics';
import { Player } from './player/player';
import { InputManager } from './player/input';
import { SceneRenderer } from './renderer/scene';
import { GameClock } from './core/time';
import { GameLoop } from './core/loop';
import { gameEvents, EventBus } from './core/events';
import { SaveManager, IndexedDBStore, type SaveDataV1 } from './persistence/persistence';
import { Inventory } from './player/inventory';
import { BlockInteraction } from './player/block-interaction';
import { Survival } from './player/survival';
import { ParticleSystem } from './renderer/particles';
import { renderHud } from './ui/hud';
import vanillaBlocks from '../data/blocks/vanilla.json';
import type { BlockFile } from './world/blocks';

const VIEW_RADIUS = 3; // chunks in each direction
const SAVE_KEY = 'auto';
const AUTOSAVE_INTERVAL_S = 30;

function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const overlay = document.getElementById('overlay')!;
  const hud = document.getElementById('hud')!;
  const saveStatus = document.getElementById('save-status')!;
  const heartsEl = document.getElementById('hearts')!;
  const hungerEl = document.getElementById('hunger')!;
  const airEl = document.getElementById('air')!;
  const hotbarEl = document.getElementById('hotbar')!;

  // --- core systems ---------------------------------------------------------
  const registry = new BlockRegistry(vanillaBlocks as unknown as BlockFile);
  const world = new World({ seed: 20260824 });
  const events = new EventBus();
  const physics = new PhysicsWorld({ isSolid: (x, y, z) => {
    if (y < 0) return true;
    const id = world.getBlock(x, y, z);
    const def = registry.byId(id);
    return def?.solid ?? false;
  }});

  const spawn = world.findSpawn(8, 8);
  const player = new Player({ position: spawn });
  const input = new InputManager();
  const renderer = new SceneRenderer({ canvas, world, registry });
  const saves = new SaveManager(new IndexedDBStore());
  const clock = new GameClock();
  const inventory = new Inventory();
  const interaction = new BlockInteraction({ world, registry, inventory, events });
  const survival = new Survival({
    isWater: (x, y, z) => world.getBlock(x, y, z) === 5,
    headUnderwater: (body) => world.getBlock(
      Math.floor(body.position.x),
      Math.floor(body.position.y + 1.62),
      Math.floor(body.position.z),
    ) === 5,
  });
  const particles = new ParticleSystem();

  // break → particles + chunk remesh
  events.on<{ x: number; y: number; z: number; id: number }>('block:break', ({ x, y, z, id }) => {
    particles.burst(x, y, z, id % 8);
    const ccx = Math.floor(x / 16), ccz = Math.floor(z / 16);
    renderer.updateChunk(ccx, ccz); // remesh the affected chunk
  });
  events.on<{ x: number; y: number; z: number }>('block:place', ({ x, z }) => {
    renderer.updateChunk(Math.floor(x / 16), Math.floor(z / 16));
  });

  // --- chunk streaming ------------------------------------------------------
  let lastChunkX = NaN;
  let lastChunkZ = NaN;

  function refreshChunks(force = false): void {
    const px = Math.floor(player.body.position.x);
    const pz = Math.floor(player.body.position.z);
    const ccx = Math.floor(px / 16);
    const ccz = Math.floor(pz / 16);
    if (!force && ccx === lastChunkX && ccz === lastChunkZ) return;
    lastChunkX = ccx;
    lastChunkZ = ccz;
    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        world.ensureChunk(ccx + dx, ccz + dz);
        renderer.updateChunk(ccx + dx, ccz + dz);
      }
    }
  }

  // --- save / load ----------------------------------------------------------
  async function saveGame(): Promise<void> {
    const data: SaveDataV1 = {
      version: 1,
      seed: world.seed,
      player: {
        x: player.body.position.x,
        y: player.body.position.y,
        z: player.body.position.z,
        yaw: player.yawAngle,
        pitch: player.pitchAngle,
      },
      edits: world.exportEdits(),
      savedAt: Date.now(),
    };
    await saves.save(SAVE_KEY, data);
    // inventory persists alongside the world (separate key, same store)
    await saves.save(SAVE_KEY + ':inv', inventory.export() as unknown as never);
    saveStatus.style.opacity = '1';
    setTimeout(() => (saveStatus.style.opacity = '0'), 1500);
    gameEvents.emit('game:saved', { slot: SAVE_KEY });
  }

  async function tryLoadGame(): Promise<boolean> {
    const data = await saves.load(SAVE_KEY);
    if (!data || data.seed !== world.seed) return false;
    world.importEdits(data.edits);
    player.body.position.x = data.player.x;
    player.body.position.y = data.player.y;
    player.body.position.z = data.player.z;
    player.look(0, 0); // reset
    const stored = await saves.load(SAVE_KEY + ':inv');
    if (stored) inventory.import(stored as unknown as ReturnType<Inventory['export']>);
    return true;
  }

  // --- input & overlay ------------------------------------------------------
  input.attach();
  let mouseDown = false;
  let lastImpactVy = 0;
  overlay.addEventListener('click', () => canvas.requestPointerLock());
  canvas.addEventListener('click', () => canvas.requestPointerLock());
  canvas.addEventListener('mousedown', (e) => {
    if (!document.pointerLockElement) return;
    if (e.button === 0) mouseDown = true; // left = mine
    if (e.button === 2) { // right = place
      const eye = player.eyePosition;
      const hit = raycast(eye, yawPitchDir(), 5);
      if (hit) interaction.placeSelected(hit.x, hit.y, hit.z);
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouseDown = false;
      interaction.cancel();
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => {
    inventory.select(inventory.selected + (e.deltaY > 0 ? 1 : -1));
  });

  /** Voxel DDA-lite: step along the view ray up to `reach`, return first solid cell. */
  function yawPitchDir(): { x: number; y: number; z: number } {
    const cp = Math.cos(player.pitchAngle);
    return {
      x: -Math.sin(player.yawAngle) * cp,
      y: Math.sin(player.pitchAngle),
      z: -Math.cos(player.yawAngle) * cp,
    };
  }
  function raycast(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    reach: number,
  ): { x: number; y: number; z: number } | null {
    const steps = Math.ceil(reach / 0.05);
    for (let i = 1; i <= steps; i++) {
      const t = i * 0.05;
      const x = Math.floor(origin.x + dir.x * t);
      const y = Math.floor(origin.y + dir.y * t);
      const z = Math.floor(origin.z + dir.z * t);
      const def = registry.byId(world.getBlock(x, y, z));
      if (def?.solid) return { x, y, z };
    }
    return null;
  }

  document.addEventListener('pointerlockchange', () => {
    overlay.style.display = document.pointerLockElement ? 'none' : 'flex';
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F5') {
      e.preventDefault();
      void saveGame();
    }
  });
  window.addEventListener('resize', () => renderer.resize());
  window.addEventListener('beforeunload', () => {
    void saveGame();
  });

  // --- game loop ------------------------------------------------------------
  let autosaveTimer = 0;

  function update(dtMs: number): void {
    const dt = dtMs / 1000;
    const md = input.consumeMouseDelta();
    player.look(md.dx, md.dy);
    player.move(input.moveIntent());
    if (input.consumeJump()) player.tryJump();

    // swimming: water damps movement & fall (simple buoyancy)
    const feetInWater = world.getBlock(
      Math.floor(player.body.position.x),
      Math.floor(player.body.position.y),
      Math.floor(player.body.position.z),
    ) === 5;
    if (feetInWater) {
      player.body.velocity.y = Math.max(player.body.velocity.y, -4); // slow sink
      if (input.isDown('Space')) player.body.velocity.y = 3; // swim up
    }

    lastImpactVy = Math.min(lastImpactVy, player.body.velocity.y);
    const vyBefore = player.body.velocity.y;
    const wasOnGround = player.body.onGround;
    physics.step(player.body, dt);

    // survival tick: detect landing this step
    const landed = !wasOnGround && player.body.onGround && vyBefore < 0;
    survival.tick(player.body, dt, landed, -vyBefore);

    // mining: continuous while left mouse held
    if (mouseDown && document.pointerLockElement) {
      const hit = raycast(player.eyePosition, yawPitchDir(), 5);
      if (hit) {
        interaction.startMining(hit.x, hit.y, hit.z);
        interaction.tickMining(dt);
      } else {
        interaction.cancel();
      }
    }

    particles.update(dt);
    refreshChunks();

    autosaveTimer += dtMs / 1000;
    if (autosaveTimer >= AUTOSAVE_INTERVAL_S) {
      autosaveTimer = 0;
      void saveGame();
    }
  }

  function render(alpha: number): void {
    void alpha; // interpolation arrives with entity systems (Phase 3/4)
    const eye = player.eyePosition;
    renderer.camera.position.set(eye.x, eye.y, eye.z);
    renderer.camera.rotation.order = 'YXZ';
    renderer.camera.rotation.y = player.yawAngle;
    renderer.camera.rotation.x = player.pitchAngle;
    renderer.render();
    const pos = player.body.position;

    // survival + hotbar HUD
    renderHud(
      {
        health: survival.health,
        maxHealth: survival.max,
        hunger: 20, // hunger mechanics arrive with entities (Phase 4)
        air: survival.airRemaining,
        airMax: 15,
        selectedSlot: inventory.selected,
        slots: inventory.slots.slice(0, 9),
      },
      {
        hearts: heartsEl,
        hunger: hungerEl,
        air: airEl,
        hotbar: hotbarEl,
      },
    );

    hud.textContent =
      `FPS: ${clock.fps.toFixed(0)}  XYZ: ${pos.x.toFixed(1)} ${pos.y.toFixed(1)} ${pos.z.toFixed(1)}\n` +
      `Chunks: ${world.loadedChunkCount}  Meshes: ${renderer.meshCount}  Biome: ${world.biomeAt(Math.floor(pos.x), Math.floor(pos.z)).nameAr}` +
      (interaction.miningTarget ? `  ⛏ ${(interaction.miningProgress * 100).toFixed(0)}%` : '');
  }

  const loop = new GameLoop({ update, render });

  // --- boot -----------------------------------------------------------------
  void (async () => {
    await tryLoadGame();
    refreshChunks(true);
    let last = performance.now();
    function frame(now: number): void {
      const dt = clock.tick(now - last);
      last = now;
      loop.tickFrame(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();
}

window.addEventListener('DOMContentLoaded', main);
