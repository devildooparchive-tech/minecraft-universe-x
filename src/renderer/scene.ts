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
  readonly sunLight: THREE.DirectionalLight;
  readonly ambientLight: THREE.AmbientLight;
  private readonly world: World;
  private readonly registry: BlockRegistry;
  /** solid + water + decor meshes per chunk (3 entries per key) */
  private readonly chunkMeshes = new Map<string, THREE.Mesh>();
  private readonly material: THREE.MeshLambertMaterial;
  private readonly waterMaterial: THREE.MeshLambertMaterial;
  private readonly decorMaterial: THREE.MeshBasicMaterial;
  /** clouds ceiling */
  private cloudMesh?: THREE.Mesh;

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

    // Lights — exposed for the day/night cycle driver
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    this.sunLight.position.set(50, 120, 30);
    this.scene.add(this.ambientLight, this.sunLight);

    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    // translucent water — slightly blue-tinted, no depth write to avoid artifacts
    this.waterMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // plants: unlit bright billboards, double-sided
    this.decorMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    // --- flat cloud layer at y=90 (classic MC style) ---
    const cloudGeo = new THREE.PlaneGeometry(1200, 1200);
    cloudGeo.rotateX(-Math.PI / 2);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.cloudMesh.position.y = 90;
    this.scene.add(this.cloudMesh);
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

    const makeMesh = (
      pos: Float32Array,
      nor: Float32Array,
      col: Float32Array,
      idx: Uint32Array,
      mat: THREE.Material,
      suffix: string,
    ): void => {
      const k = key + suffix;
      const old = this.chunkMeshes.get(k);
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
        this.chunkMeshes.delete(k);
      }
      if (idx.length === 0) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = suffix === ':w' ? 1 : 0;
      this.scene.add(mesh);
      this.chunkMeshes.set(k, mesh);
    };

    makeMesh(data.positions, data.normals, data.colors, data.indices, this.material, '');
    makeMesh(
      data.waterPositions,
      data.waterNormals,
      data.waterColors,
      data.waterIndices,
      this.waterMaterial,
      ':w',
    );
    makeMesh(
      data.decorPositions,
      data.decorNormals,
      data.decorColors,
      data.decorIndices,
      this.decorMaterial,
      ':d',
    );
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
