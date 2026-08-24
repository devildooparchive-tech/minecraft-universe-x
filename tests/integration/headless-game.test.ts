/**
 * Headless integration test — runs the REAL game systems (no browser, no three.js):
 * world gen → spawn → simulated input → physics steps → chunk streaming →
 * block edit → save (MemoryStore) → simulated restart → reload → verify.
 *
 * This is the "does the game actually work" gate beyond unit tests.
 */

import { World } from '../../src/world/world';
import { BlockRegistry, type BlockFile } from '../../src/world/blocks';
import { PhysicsWorld } from '../../src/physics/physics';
import { Player } from '../../src/player/player';
import { SaveManager, MemoryStore, type SaveDataV1 } from '../../src/persistence/persistence';
import vanilla from '../../data/blocks/vanilla.json';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  const mark = cond ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
}

// --- 1. Boot ---------------------------------------------------------------
const registry = new BlockRegistry(vanilla as unknown as BlockFile);
check('registry loaded', registry.count === 12, `${registry.count} blocks`);

const world = new World({ seed: 20260824 });
const physics = new PhysicsWorld({
  isSolid: (x, y, z) => {
    if (y < 0) return true;
    const def = registry.byId(world.getBlock(x, y, z));
    return def?.solid ?? false;
  },
});

// --- 2. Spawn on terrain ----------------------------------------------------
const spawn = world.findSpawn(8, 8);
const player = new Player({ position: spawn });
world.ensureChunk(0, 0);
const surfaceY = world.heightAt(8, 8);
check('spawn above surface', player.body.position.y >= surfaceY, `spawn y=${spawn.y.toFixed(2)} surface=${surfaceY}`);

// --- 3. Fall & land ----------------------------------------------------------
player.body.position.y = surfaceY + 6; // drop from above
player.body.onGround = false;
for (let i = 0; i < 300; i++) physics.step(player.body, 1 / 60);
check('landed on ground', player.body.onGround, `y=${player.body.position.y.toFixed(3)}`);
check('resting at surface', Math.abs(player.body.position.y - (surfaceY + 1)) < 1.5, `y=${player.body.position.y.toFixed(3)} vs surface+1=${surfaceY + 1}`);

// --- 4. Walk forward (W) for 2 seconds (with per-frame chunk streaming, like main.ts) ---
player.move({ forward: 1, strafe: 0 });
const startX = player.body.position.x;
const startZ = player.body.position.z;
for (let i = 0; i < 120; i++) {
  // stream chunks around the player EVERY step (same contract as refreshChunks in main.ts)
  world.ensureChunk(Math.floor(player.body.position.x / 16), Math.floor(player.body.position.z / 16));
  physics.step(player.body, 1 / 60);
}
const moved = Math.hypot(player.body.position.x - startX, player.body.position.z - startZ);
check('player walked > 5 blocks in 2s', moved > 5, `moved=${moved.toFixed(2)}`);

// --- 5. Chunk streaming around new position ----------------------------------
const px = Math.floor(player.body.position.x);
const pz = Math.floor(player.body.position.z);
const ccx = Math.floor(px / 16);
const ccz = Math.floor(pz / 16);
let meshable = 0;
for (let dz = -1; dz <= 1; dz++) {
  for (let dx = -1; dx <= 1; dx++) {
    world.ensureChunk(ccx + dx, ccz + dz);
    if (world.getChunk(ccx + dx, ccz + dz)!.solidCount() > 0) meshable++;
  }
}
check('3x3 chunks loaded with terrain', meshable === 9, `${meshable}/9 have blocks`);

// --- 6. Jump ------------------------------------------------------------------
const beforeJump = player.body.position.y;
player.body.onGround = true;
player.tryJump();
let peak = beforeJump;
for (let i = 0; i < 90; i++) {
  physics.step(player.body, 1 / 60);
  peak = Math.max(peak, player.body.position.y);
}
check('jump gained height', peak > beforeJump + 1, `peak=${peak.toFixed(2)} from=${beforeJump.toFixed(2)}`);

// --- 7. Build: place blocks (right-click equivalent) ---------------------------
const bx = Math.floor(player.body.position.x) + 2;
const bz = Math.floor(player.body.position.z);
const by = world.heightAt(bx, bz) + 1;
world.setBlock(bx, by, bz, 11); // glowstone
check('block placed', world.getBlock(bx, by, bz) === 11);
world.setBlock(bx, by + 1, bz, 10); // obsidian on top
check('second block placed', world.getBlock(bx, by + 1, bz) === 10);

// --- 8. Save (simulating F5 / autosave) ----------------------------------------
const store = new MemoryStore();
const session1 = new SaveManager(store);
const save: SaveDataV1 = {
  version: 1,
  seed: world.seed,
  player: {
    x: player.body.position.x,
    y: player.body.position.y,
    z: player.body.position.z,
    yaw: 0.7,
    pitch: -0.2,
  },
  edits: world.exportEdits(),
  savedAt: Date.now(),
};
await session1.save('auto', save);
check('save written', (await session1.load('auto')) !== null);

// --- 9. Restart & reload --------------------------------------------------------
const session2 = new SaveManager(store); // new session, same storage = app restart
const loaded = await session2.load('auto');
check('save loaded after restart', loaded !== null);
const world2 = new World({ seed: loaded!.seed });
world2.importEdits(loaded!.edits);
world2.ensureChunk(0, 0);
world2.ensureChunk(ccx, ccz);
check('edits survived restart', world2.getBlock(bx, by, bz) === 11 && world2.getBlock(bx, by + 1, bz) === 10);

const player2 = new Player({ position: { x: loaded!.player.x, y: loaded!.player.y, z: loaded!.player.z } });
check(
  'player position restored',
  Math.abs(player2.body.position.x - player.body.position.x) < 0.01 &&
    Math.abs(player2.body.position.z - player.body.position.z) < 0.01,
);

// --- 10. Determinism across full restart ----------------------------------------
const wA = new World({ seed: world.seed });
const wB = new World({ seed: world.seed });
wA.ensureChunk(-2, -2);
wB.ensureChunk(-2, -2);
let same = true;
for (let x = -32; x < -16 && same; x += 2) {
  for (let z = -32; z < -16 && same; z += 2) {
    for (let y = 10; y < 30; y += 3) {
      if (wA.getBlock(x, y, z) !== wB.getBlock(x, y, z)) {
        same = false;
        break;
      }
    }
  }
}
check('world regeneration is deterministic', same);

console.log(failures === 0 ? '\n=== ALL INTEGRATION CHECKS PASSED ===' : `\n=== ${failures} FAILURES ===`);
process.exit(failures === 0 ? 0 : 1);
