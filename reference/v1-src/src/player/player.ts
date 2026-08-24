import * as THREE from 'three';
import { BlockType, BLOCK_NAMES } from '../world/block';

export class Player {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health = 100;
  stamina = 100;
  isPositioned = false;
  inventory: { type: BlockType; count: number }[] = [
    { type: BlockType.Grass, count: 10 },
    { type: BlockType.Dirt, count: 10 },
    { type: BlockType.Stone, count: 10 },
    { type: BlockType.Wood, count: 10 },
    { type: BlockType.Sand, count: 10 },
  ];
  selectedSlot = 0;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
  }

  getSelectedBlock(): BlockType | null {
    const item = this.inventory[this.selectedSlot];
    if (!item || item.count <= 0) return null;
    return item.type;
  }

  consumeSelectedBlock(): boolean {
    const item = this.inventory[this.selectedSlot];
    if (!item || item.count <= 0) return false;
    item.count--;
    return true;
  }

  addBlock(type: BlockType, count = 1) {
    const existing = this.inventory.find(i => i.type === type);
    if (existing) existing.count += count;
    else this.inventory.push({ type, count });
  }

  getInventoryInfo(slot: number): { name: string; count: number } | null {
    const item = this.inventory[slot];
    if (!item) return null;
    return { name: BLOCK_NAMES[item.type], count: item.count };
  }
}