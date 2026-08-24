import * as THREE from 'three';
import { gameEvents } from '../core/events';

export class CameraController {
  private yaw = 0;
  private pitch = 0;
  private distance = 8;
  private unsubscribeFns: (() => void)[] = [];

  constructor(private camera: THREE.PerspectiveCamera) {
    this.unsubscribeFns.push(gameEvents.on('mouse-move', (data: { movementX: number; movementY: number }) => {
      this.yaw -= data.movementX * 0.002;
      this.pitch -= data.movementY * 0.002;
      this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
    }));
    this.unsubscribeFns.push(gameEvents.on('wheel', (data: { deltaY: number }) => {
      this.distance = Math.max(3, Math.min(15, this.distance + data.deltaY * 0.01));
    }));
  }

  getYaw(): number { return this.yaw; }

  update(playerPos: THREE.Vector3) {
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).multiplyScalar(this.distance);
    this.camera.position.copy(playerPos).add(offset);
    this.camera.lookAt(playerPos.clone().add(new THREE.Vector3(0, 1.5, 0)));
  }

  getDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  dispose() {
    for (const unsub of this.unsubscribeFns) unsub();
    this.unsubscribeFns = [];
  }
}