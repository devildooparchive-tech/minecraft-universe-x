import * as THREE from 'three';
import { Player } from './player';
import { World } from '../world/world';
import { InputManager } from './input';
import { CameraController } from './camera-controller';
import { BlockType } from '../world/block';
import { gameEvents } from '../core/events';

export class PlayerController {
  private gravity = -25;
  private moveSpeed = 6;
  private sprintMultiplier = 1.5;
  private jumpForce = 8;
  private onGround = false;
  private unsubscribeFns: (() => void)[] = [];

  constructor(
    private player: Player,
    private world: World,
    private input: InputManager,
    private cameraController: CameraController
  ) {
    this.unsubscribeFns.push(gameEvents.on('mouse-down', (data: { button: number }) => {
      if (data.button === 0) this.mine();
      else if (data.button === 2) this.place();
    }));

    this.unsubscribeFns.push(gameEvents.on('key-down', (code: string) => {
      if (code.startsWith('Digit')) {
        const num = parseInt(code.slice(5), 10);
        if (num >= 1 && num <= 5) {
          this.player.selectedSlot = num - 1;
          gameEvents.emit('hotbar-updated', this.player.selectedSlot);
        }
      }
    }));

    this.unsubscribeFns.push(gameEvents.on('hotbar-selected', (slot: number) => {
      this.player.selectedSlot = slot;
      gameEvents.emit('hotbar-updated', slot);
    }));
  }

  update(dt: number) {
    const yaw = this.cameraController.getYaw();
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    const moveVec = new THREE.Vector3();
    if (this.input.isKeyDown('KeyW')) moveVec.add(forward);
    if (this.input.isKeyDown('KeyS')) moveVec.sub(forward);
    if (this.input.isKeyDown('KeyA')) moveVec.sub(right);
    if (this.input.isKeyDown('KeyD')) moveVec.add(right);
    moveVec.normalize();

    const speed = this.input.isKeyDown('ShiftLeft') ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed;
    this.player.velocity.x = moveVec.x * speed;
    this.player.velocity.z = moveVec.z * speed;

    if (this.input.isKeyDown('Space') && this.onGround) {
      this.player.velocity.y = this.jumpForce;
      this.onGround = false;
    }

    this.player.velocity.y += this.gravity * dt;
    this.applyCollisions(dt);
  }

  private applyCollisions(dt: number) {
    const oldPos = this.player.position.clone();
    const newPos = this.player.position.clone().add(this.player.velocity.clone().multiplyScalar(dt));

    this.player.position.x = newPos.x;
    if (this.collidesWithWorld()) {
      this.player.position.x = oldPos.x;
      this.player.velocity.x = 0;
    }

    this.player.position.y = newPos.y;
    if (this.collidesWithWorld()) {
      if (this.player.velocity.y < 0) this.onGround = true;
      this.player.position.y = oldPos.y;
      this.player.velocity.y = 0;
    } else {
      this.onGround = false;
    }

    this.player.position.z = newPos.z;
    if (this.collidesWithWorld()) {
      this.player.position.z = oldPos.z;
      this.player.velocity.z = 0;
    }
  }

  private collidesWithWorld(): boolean {
    const p = this.player.position;
    const min = { x: p.x - 0.4, y: p.y - 0.9, z: p.z - 0.4 };
    const max = { x: p.x + 0.4, y: p.y + 0.9, z: p.z + 0.4 };
    for (let x = Math.floor(min.x); x <= Math.floor(max.x); x++) {
      for (let y = Math.floor(min.y); y <= Math.floor(max.y); y++) {
        for (let z = Math.floor(min.z); z <= Math.floor(max.z); z++) {
          const block = this.world.getBlock(x, y, z);
          if (block !== BlockType.Air && block !== BlockType.Water) return true;
        }
      }
    }
    return false;
  }

  private mine() {
    const dir = this.cameraController.getDirection();
    const origin = this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const hit = this.world.raycastBlock(origin, dir, 8);
    if (hit) {
      const blockType = this.world.getBlock(hit.worldX, hit.worldY, hit.worldZ);
      this.world.setBlock(hit.worldX, hit.worldY, hit.worldZ, BlockType.Air);
      this.player.addBlock(blockType, 1);
      gameEvents.emit('block-mined', { type: blockType });
      gameEvents.emit('inventory-updated', this.player.selectedSlot);
    }
  }

  private place() {
    const selected = this.player.getSelectedBlock();
    if (!selected) return;
    const dir = this.cameraController.getDirection();
    const origin = this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const hit = this.world.raycastBlock(origin, dir, 8);
    if (hit) {
      const placeX = hit.worldX + hit.face[0];
      const placeY = hit.worldY + hit.face[1];
      const placeZ = hit.worldZ + hit.face[2];
      if (this.world.getBlock(placeX, placeY, placeZ) === BlockType.Air) {
        this.world.setBlock(placeX, placeY, placeZ, selected);
        const success = this.player.consumeSelectedBlock();
        if (!success) {
          this.world.setBlock(placeX, placeY, placeZ, BlockType.Air);
        } else {
          gameEvents.emit('block-placed', { type: selected });
          gameEvents.emit('inventory-updated', this.player.selectedSlot);
        }
      }
    }
  }

  dispose() {
    for (const unsub of this.unsubscribeFns) unsub();
    this.unsubscribeFns = [];
  }
}