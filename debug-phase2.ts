
import { StructureBuilder } from './src/world/structures';
import { hash2 } from './src/world/noise3d';
import s from './data/world/structures.json';
import f from './data/world/factions.json';
import { FactionRegistry } from './src/world/factions';

// structure placement debug
for (const [cx, cz] of [[5,5],[3,3],[-3,0],[10,10]]) {
  const roll = hash2(42 ^ 0x57bc, cx, cz) / 4294967296;
  console.log(`chunk(${cx},${cz}) roll=${roll.toFixed(5)} need<0.004 → ${roll < 0.004}`);
}
// faction data sanity
const reg = new FactionRegistry(f);
console.log('verdant allies:', JSON.stringify(reg.byName('verdant')?.allies));
console.log('areAllies verdant-neutral:', reg.areAllies('verdant','neutral'));
