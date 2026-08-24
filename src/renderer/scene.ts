/**
 * SceneRenderer — owns the THREE.Scene, camera, and chunk meshes.
 *
 * Isolation: this is the ONLY file (so far) that imports three. The rest of
 * the game talks to it through this small surface — Phase 5 can swap the
 * implementation behind the same calls.
 */

import * as THREE from 'three';
import type { World } from '../world/world';
import type { BlockRegistry } from '../world/blocks';
import { buildChunkMesh } from './mesher';

export interface SceneRendererOptions {
  canvas: HTMLCanvasElement;
  world: World;
  registry: BlockRegistry;
}

export class SceneRenderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly world: World;
  private readonly registry: BlockRegistry;
  private readonly chunkMeshes = new Map<string, THREE.Mesh>();
  private readonly material: THREE.MeshLambertMaterial;

  constructor(options: SceneRendererOptions) {
    this.world = options.world;
    this.registry = options.registry;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // sky
    this.scene.fog = new THREE.Fog(0x87ceeb, 60, 140);

    this.camera = new THREE.PerspectiveCamera(
      75,
      options.canvas.clientWidth / Math.max(1, options.canvas.clientHeight),
      0.1,
      400,
    );

    this.renderer = new THREE.WebGLRenderer({ canvas: options.canvas, antialias: true });
    this.renderer.setSize(options.canvas.clientWidth, options.canvas.clientHeight, false);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(0.5, 1, 0.3).normalize();
    this.scene.add(ambient, sun);

    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  /** (Re)build the mesh for one chunk. */
  updateChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const chunk = this.world.getChunk(cx, cz);
    if (!chunk) return;

    const old = this.chunkMeshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.chunkMeshes.delete(key);
    }

    const data = buildChunkMesh(chunk, { world: this.world, registry: this.registry });
    if (data.indices.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));

    const mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(mesh);
    this.chunkMeshes.set(key, mesh);
  }

  removeChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const mesh = this.chunkMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
  }

  get meshCount(): number {
    return this.chunkMeshes.size;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = Math.max(1, canvas.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose(): void {
    for (const mesh of this.chunkMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunkMeshes.clear();
    this.material.dispose();
    this.renderer.dispose();
  }
}
