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
import { gameEvents } from './core/events';
import { SaveManager, IndexedDBStore, type SaveDataV1 } from './persistence/persistence';
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

  // --- core systems ---------------------------------------------------------
  const registry = new BlockRegistry(vanillaBlocks as unknown as BlockFile);
  const world = new World({ seed: 20260824 });
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
    return true;
  }

  // --- input & overlay ------------------------------------------------------
  input.attach();
  overlay.addEventListener('click', () => canvas.requestPointerLock());
  canvas.addEventListener('click', () => canvas.requestPointerLock());
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
    physics.step(player.body, dt);

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
    hud.textContent =
      `FPS: ${clock.fps.toFixed(0)}  XYZ: ${pos.x.toFixed(1)} ${pos.y.toFixed(1)} ${pos.z.toFixed(1)}\n` +
      `Chunks: ${world.loadedChunkCount}  Meshes: ${renderer.meshCount}`;
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
