import * as THREE from 'three';
import { gameEvents } from '../core/events';

export interface MaterialConfig {
  id: string;
  name: string;
  type: 'standard' | 'physical' | 'toon' | 'unlit' | 'custom';
  baseColor: number;
  roughness: number;
  metalness: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  alphaTest?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  flatShading?: boolean;
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  aoMap?: string;
  emissiveMap?: string;
  displacementMap?: string;
  displacementScale?: number;
  displacementBias?: number;
}

export interface LightingConfig {
  ambient: {
    color: number;
    intensity: number;
  };
  directional: {
    color: number;
    intensity: number;
    position: THREE.Vector3;
    castShadow: boolean;
    shadow: {
      mapSize: THREE.Vector2;
      cameraNear: number;
      cameraFar: number;
      cameraLeft: number;
      cameraRight: number;
      cameraTop: number;
      cameraBottom: number;
      bias: number;
      normalBias: number;
      radius: number;
    };
  };
  hemisphere: {
    skyColor: number;
    groundColor: number;
    intensity: number;
  };
  fog: {
    color: number;
    near: number;
    far: number;
    density?: number;
    type?: 'linear' | 'exponential' | 'exponential2';
  };
}

export interface ParticleConfig {
  id: string;
  name: string;
  texture: string;
  count: number;
  lifetime: { min: number; max: number };
  size: { start: number; end: number };
  color: { start: number; end: number };
  opacity: { start: number; end: number };
  velocity: THREE.Vector3;
  velocityVariance: THREE.Vector3;
  acceleration: THREE.Vector3;
  gravity: number;
  drag: number;
  rotationSpeed: { min: number; max: number };
  blendMode: THREE.Blending;
  depthWrite: boolean;
  depthTest: boolean;
  emitterShape: 'point' | 'sphere' | 'box' | 'disc' | 'cone';
  emitterSize: THREE.Vector3;
  emissionRate: number;
  emissionBursts: { time: number; count: number }[];
  loops: boolean;
  prewarm: boolean;
}

export interface PostProcessConfig {
  enabled: boolean;
  bloom: {
    enabled: boolean;
    strength: number;
    radius: number;
    threshold: number;
  };
  ssao: {
    enabled: boolean;
    radius: number;
    bias: number;
    intensity: number;
  };
  fxaa: {
    enabled: boolean;
  };
  colorGrading: {
    enabled: boolean;
    exposure: number;
    contrast: number;
    saturation: number;
    temperature: number;
  };
  vignette: {
    enabled: boolean;
    intensity: number;
    smoothness: number;
  };
  chromaticAberration: {
    enabled: boolean;
    offset: number;
  };
}

export class MaterialLibrary {
  private materials: Map<string, THREE.Material> = new Map();
  private configs: Map<string, MaterialConfig> = new Map();
  private textureLoader: THREE.TextureLoader;

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.registerDefaultMaterials();
  }

  private registerDefaultMaterials(): void {
    const materials: MaterialConfig[] = [
      {
        id: 'grass',
        name: 'Grass Block',
        type: 'standard',
        baseColor: 0x7c9c6e,
        roughness: 0.9,
        metalness: 0.0,
        vertexColors: true,
      },
      {
        id: 'dirt',
        name: 'Dirt Block',
        type: 'standard',
        baseColor: 0x8b5a2b,
        roughness: 0.95,
        metalness: 0.0,
        vertexColors: true,
      },
      {
        id: 'stone',
        name: 'Stone Block',
        type: 'standard',
        baseColor: 0x888888,
        roughness: 0.8,
        metalness: 0.1,
        vertexColors: true,
      },
      {
        id: 'sand',
        name: 'Sand Block',
        type: 'standard',
        baseColor: 0xe6d9a8,
        roughness: 0.9,
        metalness: 0.0,
        vertexColors: true,
      },
      {
        id: 'wood',
        name: 'Wood Block',
        type: 'standard',
        baseColor: 0x6b4226,
        roughness: 0.7,
        metalness: 0.0,
        vertexColors: true,
      },
      {
        id: 'leaves',
        name: 'Leaves Block',
        type: 'standard',
        baseColor: 0x2e8b57,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: 0.9,
        alphaTest: 0.5,
        vertexColors: true,
      },
      {
        id: 'water',
        name: 'Water Block',
        type: 'physical',
        baseColor: 0x3b6fd4,
        roughness: 0.1,
        metalness: 0.0,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        vertexColors: true,
      },
      {
        id: 'bedrock',
        name: 'Bedrock',
        type: 'standard',
        baseColor: 0x1a1a1a,
        roughness: 0.6,
        metalness: 0.3,
        vertexColors: true,
      },
      {
        id: 'coal_ore',
        name: 'Coal Ore',
        type: 'standard',
        baseColor: 0x3a3a3a,
        roughness: 0.7,
        metalness: 0.2,
        vertexColors: true,
      },
      {
        id: 'iron_ore',
        name: 'Iron Ore',
        type: 'standard',
        baseColor: 0x9a7a5a,
        roughness: 0.6,
        metalness: 0.4,
        vertexColors: true,
      },
      {
        id: 'gold_ore',
        name: 'Gold Ore',
        type: 'standard',
        baseColor: 0xe6c85a,
        roughness: 0.4,
        metalness: 0.8,
        vertexColors: true,
      },
      {
        id: 'diamond_ore',
        name: 'Diamond Ore',
        type: 'standard',
        baseColor: 0x5ae6e6,
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0x00ffff,
        emissiveIntensity: 0.2,
        vertexColors: true,
      },
      {
        id: 'redstone_ore',
        name: 'Redstone Ore',
        type: 'standard',
        baseColor: 0x8a2a2a,
        roughness: 0.5,
        metalness: 0.3,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
        vertexColors: true,
      },
      {
        id: 'lapis_ore',
        name: 'Lapis Ore',
        type: 'standard',
        baseColor: 0x2a4a8a,
        roughness: 0.5,
        metalness: 0.2,
        vertexColors: true,
      },
      {
        id: 'netherrack',
        name: 'Netherrack',
        type: 'standard',
        baseColor: 0xb33a3a,
        roughness: 0.8,
        metalness: 0.1,
        vertexColors: true,
      },
      {
        id: 'soul_sand',
        name: 'Soul Sand',
        type: 'standard',
        baseColor: 0x7a4a7a,
        roughness: 0.9,
        metalness: 0.0,
        vertexColors: true,
      },
      {
        id: 'basalt',
        name: 'Basalt',
        type: 'standard',
        baseColor: 0x3a3a3a,
        roughness: 0.6,
        metalness: 0.2,
        vertexColors: true,
      },
      {
        id: 'end_stone',
        name: 'End Stone',
        type: 'standard',
        baseColor: 0x9c9cac,
        roughness: 0.7,
        metalness: 0.1,
        vertexColors: true,
      },
      {
        id: 'glowstone',
        name: 'Glowstone',
        type: 'standard',
        baseColor: 0xffd700,
        roughness: 0.3,
        metalness: 0.0,
        emissive: 0xffd700,
        emissiveIntensity: 1.0,
        vertexColors: true,
      },
      {
        id: 'character_skin',
        name: 'Character Skin',
        type: 'standard',
        baseColor: 0xffdbc9,
        roughness: 0.5,
        metalness: 0.0,
        vertexColors: true,
      },
      {
        id: 'character_cloth',
        name: 'Character Cloth',
        type: 'standard',
        baseColor: 0x4a6fa5,
        roughness: 0.8,
        metalness: 0.0,
        vertexColors: true,
      },
      {
        id: 'character_metal',
        name: 'Character Metal',
        type: 'physical',
        baseColor: 0xaaaaaa,
        roughness: 0.2,
        metalness: 0.9,
        vertexColors: true,
      },
    ];

    for (const config of materials) {
      this.registerMaterial(config);
    }
  }

  registerMaterial(config: MaterialConfig): THREE.Material {
    let material: THREE.Material;

    switch (config.type) {
      case 'standard':
        material = new THREE.MeshStandardMaterial({
          color: config.baseColor,
          roughness: config.roughness,
          metalness: config.metalness,
          emissive: config.emissive ? new THREE.Color(config.emissive) : undefined,
          emissiveIntensity: config.emissiveIntensity || 0,
          transparent: config.transparent || false,
          opacity: config.opacity || 1,
          alphaTest: config.alphaTest || 0,
          side: config.side || THREE.FrontSide,
          vertexColors: config.vertexColors || false,
          flatShading: config.flatShading || false,
        });
        break;
      case 'physical':
        material = new THREE.MeshPhysicalMaterial({
          color: config.baseColor,
          roughness: config.roughness,
          metalness: config.metalness,
          emissive: config.emissive ? new THREE.Color(config.emissive) : undefined,
          emissiveIntensity: config.emissiveIntensity || 0,
          transparent: config.transparent || false,
          opacity: config.opacity || 1,
          alphaTest: config.alphaTest || 0,
          side: config.side || THREE.FrontSide,
          vertexColors: config.vertexColors || false,
          flatShading: config.flatShading || false,
          clearcoat: 0,
          clearcoatRoughness: 0,
        });
        break;
      case 'toon':
        material = new THREE.MeshToonMaterial({
          color: config.baseColor,
          emissive: config.emissive ? new THREE.Color(config.emissive) : undefined,
          emissiveIntensity: config.emissiveIntensity || 0,
          transparent: config.transparent || false,
          opacity: config.opacity || 1,
          alphaTest: config.alphaTest || 0,
          side: config.side || THREE.FrontSide,
          vertexColors: config.vertexColors || false,
        });
        break;
      case 'unlit':
        material = new THREE.MeshBasicMaterial({
          color: config.baseColor,
          transparent: config.transparent || false,
          opacity: config.opacity || 1,
          alphaTest: config.alphaTest || 0,
          side: config.side || THREE.FrontSide,
          vertexColors: config.vertexColors || false,
        });
        break;
      default:
        material = new THREE.MeshStandardMaterial({
          color: config.baseColor,
          roughness: config.roughness,
          metalness: config.metalness,
        });
    }

    if (config.map) {
      (material as any).map = this.textureLoader.load(config.map);
    }
    if (config.normalMap) {
      (material as any).normalMap = this.textureLoader.load(config.normalMap);
    }
    if (config.roughnessMap) {
      (material as any).roughnessMap = this.textureLoader.load(config.roughnessMap);
    }
    if (config.metalnessMap) {
      (material as any).metalnessMap = this.textureLoader.load(config.metalnessMap);
    }
    if (config.aoMap) {
      (material as any).aoMap = this.textureLoader.load(config.aoMap);
    }
    if (config.emissiveMap) {
      (material as any).emissiveMap = this.textureLoader.load(config.emissiveMap);
    }
    if (config.displacementMap) {
      (material as any).displacementMap = this.textureLoader.load(config.displacementMap);
      (material as any).displacementScale = config.displacementScale || 1;
      (material as any).displacementBias = config.displacementBias || 0;
    }

    this.materials.set(config.id, material);
    this.configs.set(config.id, config);

    return material;
  }

  getMaterial(id: string): THREE.Material | undefined {
    return this.materials.get(id);
  }

  getConfig(id: string): MaterialConfig | undefined {
    return this.configs.get(id);
  }

  getMaterialForBlock(blockType: number): THREE.Material {
    const blockMaterials: Record<number, string> = {
      0: 'air',
      1: 'grass',
      2: 'dirt',
      3: 'stone',
      4: 'sand',
      5: 'wood',
      6: 'leaves',
      7: 'water',
    };
    const matId = blockMaterials[blockType] || 'stone';
    return this.materials.get(matId) || this.materials.get('stone')!;
  }

  cloneMaterial(id: string, overrides: Partial<MaterialConfig> = {}): THREE.Material {
    const original = this.materials.get(id);
    if (!original) throw new Error(`Material ${id} not found`);
    
    const cloned = original.clone();
    if (overrides.baseColor !== undefined) (cloned as any).color?.setHex(overrides.baseColor);
    if (overrides.roughness !== undefined) (cloned as any).roughness = overrides.roughness;
    if (overrides.metalness !== undefined) (cloned as any).metalness = overrides.metalness;
    if (overrides.emissive !== undefined) (cloned as any).emissive = new THREE.Color(overrides.emissive);
    if (overrides.emissiveIntensity !== undefined) (cloned as any).emissiveIntensity = overrides.emissiveIntensity;
    if (overrides.transparent !== undefined) cloned.transparent = overrides.transparent;
    if (overrides.opacity !== undefined) cloned.opacity = overrides.opacity;
    
    return cloned;
  }

  dispose(): void {
    for (const material of this.materials.values()) {
      material.dispose();
    }
    this.materials.clear();
    this.configs.clear();
  }
}

export class LightingManager {
  private scene: THREE.Scene;
  private config: LightingConfig;
  private directionalLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private hemisphereLight: THREE.HemisphereLight | null = null;
  private shadowCamera: THREE.OrthographicCamera | null = null;
  private timeOfDay = 0;
  private dayDuration = 1200;

  constructor(scene: THREE.Scene, config?: Partial<LightingConfig>) {
    this.scene = scene;
    this.config = this.getDefaultConfig();
    if (config) this.mergeConfig(config);
    this.setupLighting();
  }

  private getDefaultConfig(): LightingConfig {
    return {
      ambient: { color: 0xffffff, intensity: 0.3 },
      directional: {
        color: 0xffffff,
        intensity: 1.0,
        position: new THREE.Vector3(100, 200, 50),
        castShadow: true,
        shadow: {
          mapSize: new THREE.Vector2(2048, 2048),
          cameraNear: 1,
          cameraFar: 500,
          cameraLeft: -100,
          cameraRight: 100,
          cameraTop: 100,
          cameraBottom: -100,
          bias: -0.0005,
          normalBias: 0.02,
          radius: 4,
        },
      },
      hemisphere: {
        skyColor: 0x87ceeb,
        groundColor: 0x4a3a2a,
        intensity: 0.5,
      },
      fog: {
        color: 0x87ceeb,
        near: 10,
        far: 200,
        type: 'linear',
      },
    };
  }

  private mergeConfig(config: Partial<LightingConfig>): void {
    if (config.ambient) Object.assign(this.config.ambient, config.ambient);
    if (config.directional) Object.assign(this.config.directional, config.directional);
    if (config.hemisphere) Object.assign(this.config.hemisphere, config.hemisphere);
    if (config.fog) Object.assign(this.config.fog, config.fog);
  }

  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(this.config.ambient.color, this.config.ambient.intensity);
    this.scene.add(this.ambientLight);

    this.hemisphereLight = new THREE.HemisphereLight(
      this.config.hemisphere.skyColor,
      this.config.hemisphere.groundColor,
      this.config.hemisphere.intensity
    );
    this.scene.add(this.hemisphereLight);

    this.directionalLight = new THREE.DirectionalLight(
      this.config.directional.color,
      this.config.directional.intensity
    );
    this.directionalLight.position.copy(this.config.directional.position);
    this.directionalLight.castShadow = this.config.directional.castShadow;

    if (this.directionalLight.castShadow) {
      const shadow = this.config.directional.shadow;
      this.directionalLight.shadow.mapSize.set(shadow.mapSize.x, shadow.mapSize.y);
      this.directionalLight.shadow.camera.near = shadow.cameraNear;
      this.directionalLight.shadow.camera.far = shadow.cameraFar;
      this.directionalLight.shadow.camera.left = shadow.cameraLeft;
      this.directionalLight.shadow.camera.right = shadow.cameraRight;
      this.directionalLight.shadow.camera.top = shadow.cameraTop;
      this.directionalLight.shadow.camera.bottom = shadow.cameraBottom;
      this.directionalLight.shadow.bias = shadow.bias;
      this.directionalLight.shadow.normalBias = shadow.normalBias;
      this.directionalLight.shadow.radius = shadow.radius;
    }

    this.scene.add(this.directionalLight);

    this.scene.fog = new THREE.Fog(
      this.config.fog.color,
      this.config.fog.near,
      this.config.fog.far
    );
  }

  update(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.timeOfDay += deltaTime / this.dayDuration;
    if (this.timeOfDay >= 1) this.timeOfDay -= 1;

    const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(sunAngle);
    const sunAzimuth = Math.cos(sunAngle);

    if (this.directionalLight) {
      this.directionalLight.position.set(
        playerPosition.x + sunAzimuth * 100,
        playerPosition.y + Math.max(50, sunHeight * 150 + 50),
        playerPosition.z + Math.sin(sunAngle) * 100
      );
      this.directionalLight.target.position.copy(playerPosition);

      const intensity = Math.max(0.1, Math.sin(sunAngle + Math.PI / 2));
      this.directionalLight.intensity = intensity * this.config.directional.intensity;

      if (this.ambientLight) {
        this.ambientLight.intensity = Math.max(0.1, intensity * 0.5);
      }

      if (this.hemisphereLight) {
        const skyIntensity = Math.max(0.1, intensity);
        this.hemisphereLight.intensity = skyIntensity * this.config.hemisphere.intensity;
        
        const skyColor = new THREE.Color(this.config.hemisphere.skyColor);
        const nightColor = new THREE.Color(0x1a1a3a);
        skyColor.lerp(nightColor, 1 - intensity);
        this.hemisphereLight.color.set(skyColor);
        
        const groundColor = new THREE.Color(this.config.hemisphere.groundColor);
        const nightGround = new THREE.Color(0x1a1a1a);
        groundColor.lerp(nightGround, 1 - intensity);
        this.hemisphereLight.groundColor.set(groundColor);
      }

      if (this.scene.fog) {
        const fogColor = new THREE.Color(this.config.fog.color);
        const nightFog = new THREE.Color(0x1a1a3a);
        fogColor.lerp(nightFog, 1 - intensity);
        this.scene.fog.color.set(fogColor);
      }
    }
  }

  setTimeOfDay(time: number): void {
    this.timeOfDay = Math.max(0, Math.min(1, time));
  }

  getTimeOfDay(): number {
    return this.timeOfDay;
  }

  getDayPhase(): 'dawn' | 'day' | 'dusk' | 'night' {
    if (this.timeOfDay < 0.2) return 'dawn';
    if (this.timeOfDay < 0.6) return 'day';
    if (this.timeOfDay < 0.8) return 'dusk';
    return 'night';
  }

  setWeather(weather: 'clear' | 'rain' | 'thunder' | 'snow'): void {
    if (!this.scene.fog) return;
    
    // Check if it's a linear Fog (has near/far properties)
    if ('near' in this.scene.fog) {
      const fog = this.scene.fog as THREE.Fog;
      switch (weather) {
        case 'clear':
          fog.near = 10;
          fog.far = 200;
          break;
        case 'rain':
          fog.near = 5;
          fog.far = 80;
          break;
        case 'thunder':
          fog.near = 2;
          fog.far = 50;
          break;
        case 'snow':
          fog.near = 5;
          fog.far = 100;
          break;
      }
    }
  }

  dispose(): void {
    if (this.ambientLight) this.scene.remove(this.ambientLight);
    if (this.hemisphereLight) this.scene.remove(this.hemisphereLight);
    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
      this.directionalLight.shadow.map?.dispose();
    }
    if (this.scene.fog) this.scene.fog = null;
  }
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Map<string, ParticleEmitter> = new Map();
  private configs: Map<string, ParticleConfig> = new Map();
  private textureLoader: THREE.TextureLoader;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.textureLoader = new THREE.TextureLoader();
    this.registerDefaultParticles();
  }

  private registerDefaultParticles(): void {
    const particles: ParticleConfig[] = [
      {
        id: 'block_break',
        name: 'Block Break',
        texture: 'particle/block.png',
        count: 20,
        lifetime: { min: 0.3, max: 0.8 },
        size: { start: 0.15, end: 0 },
        color: { start: 0xffffff, end: 0xffffff },
        opacity: { start: 1, end: 0 },
        velocity: new THREE.Vector3(0, 2, 0),
        velocityVariance: new THREE.Vector3(3, 3, 3),
        acceleration: new THREE.Vector3(0, -10, 0),
        gravity: 1,
        drag: 0.98,
        rotationSpeed: { min: -5, max: 5 },
        blendMode: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'point',
        emitterSize: new THREE.Vector3(0.2, 0.2, 0.2),
        emissionRate: 0,
        emissionBursts: [{ time: 0, count: 20 }],
        loops: false,
        prewarm: false,
      },
      {
        id: 'footstep_dust',
        name: 'Footstep Dust',
        texture: 'particle/dust.png',
        count: 5,
        lifetime: { min: 0.2, max: 0.5 },
        size: { start: 0.1, end: 0.3 },
        color: { start: 0xaaaaaa, end: 0x888888 },
        opacity: { start: 0.5, end: 0 },
        velocity: new THREE.Vector3(0, 1, 0),
        velocityVariance: new THREE.Vector3(1, 1, 1),
        acceleration: new THREE.Vector3(0, -5, 0),
        gravity: 1,
        drag: 0.95,
        rotationSpeed: { min: -2, max: 2 },
        blendMode: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'disc',
        emitterSize: new THREE.Vector3(0.3, 0.05, 0.3),
        emissionRate: 0,
        emissionBursts: [{ time: 0, count: 5 }],
        loops: false,
        prewarm: false,
      },
      {
        id: 'torch_flame',
        name: 'Torch Flame',
        texture: 'particle/flame.png',
        count: 30,
        lifetime: { min: 0.5, max: 1.5 },
        size: { start: 0.15, end: 0 },
        color: { start: 0xff6600, end: 0xff3300 },
        opacity: { start: 0.8, end: 0 },
        velocity: new THREE.Vector3(0, 2, 0),
        velocityVariance: new THREE.Vector3(0.5, 1, 0.5),
        acceleration: new THREE.Vector3(0, 5, 0),
        gravity: -0.5,
        drag: 0.98,
        rotationSpeed: { min: -3, max: 3 },
        blendMode: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'point',
        emitterSize: new THREE.Vector3(0.1, 0.1, 0.1),
        emissionRate: 15,
        emissionBursts: [],
        loops: true,
        prewarm: true,
      },
      {
        id: 'magic_sparkle',
        name: 'Magic Sparkle',
        texture: 'particle/sparkle.png',
        count: 20,
        lifetime: { min: 0.5, max: 2.0 },
        size: { start: 0.1, end: 0.3 },
        color: { start: 0x00ffff, end: 0xff00ff },
        opacity: { start: 1, end: 0 },
        velocity: new THREE.Vector3(0, 0.5, 0),
        velocityVariance: new THREE.Vector3(1, 2, 1),
        acceleration: new THREE.Vector3(0, 1, 0),
        gravity: -0.2,
        drag: 0.99,
        rotationSpeed: { min: -10, max: 10 },
        blendMode: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'sphere',
        emitterSize: new THREE.Vector3(0.5, 1, 0.5),
        emissionRate: 10,
        emissionBursts: [],
        loops: true,
        prewarm: false,
      },
      {
        id: 'blood_splatter',
        name: 'Blood Splatter',
        texture: 'particle/blood.png',
        count: 15,
        lifetime: { min: 0.3, max: 1.0 },
        size: { start: 0.08, end: 0.15 },
        color: { start: 0x8b0000, end: 0x5a0000 },
        opacity: { start: 0.9, end: 0 },
        velocity: new THREE.Vector3(0, 0, 0),
        velocityVariance: new THREE.Vector3(5, 5, 5),
        acceleration: new THREE.Vector3(0, -20, 0),
        gravity: 1,
        drag: 0.95,
        rotationSpeed: { min: -10, max: 10 },
        blendMode: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'point',
        emitterSize: new THREE.Vector3(0.1, 0.1, 0.1),
        emissionRate: 0,
        emissionBursts: [{ time: 0, count: 15 }],
        loops: false,
        prewarm: false,
      },
      {
        id: 'healing_particles',
        name: 'Healing Particles',
        texture: 'particle/heal.png',
        count: 30,
        lifetime: { min: 1.0, max: 3.0 },
        size: { start: 0.1, end: 0.2 },
        color: { start: 0x00ff00, end: 0xffffff },
        opacity: { start: 0.8, end: 0 },
        velocity: new THREE.Vector3(0, 1, 0),
        velocityVariance: new THREE.Vector3(0.5, 1, 0.5),
        acceleration: new THREE.Vector3(0, 2, 0),
        gravity: -0.3,
        drag: 0.98,
        rotationSpeed: { min: -2, max: 2 },
        blendMode: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'sphere',
        emitterSize: new THREE.Vector3(0.5, 1, 0.5),
        emissionRate: 15,
        emissionBursts: [],
        loops: true,
        prewarm: false,
      },
      {
        id: 'critical_hit',
        name: 'Critical Hit',
        texture: 'particle/crit.png',
        count: 10,
        lifetime: { min: 0.2, max: 0.5 },
        size: { start: 0.3, end: 0.5 },
        color: { start: 0xffff00, end: 0xff8800 },
        opacity: { start: 1, end: 0 },
        velocity: new THREE.Vector3(0, 5, 0),
        velocityVariance: new THREE.Vector3(2, 2, 2),
        acceleration: new THREE.Vector3(0, -10, 0),
        gravity: 1,
        drag: 0.95,
        rotationSpeed: { min: -20, max: 20 },
        blendMode: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'point',
        emitterSize: new THREE.Vector3(0.2, 0.2, 0.2),
        emissionRate: 0,
        emissionBursts: [{ time: 0, count: 10 }],
        loops: false,
        prewarm: false,
      },
      {
        id: 'level_up',
        name: 'Level Up',
        texture: 'particle/levelup.png',
        count: 50,
        lifetime: { min: 1.0, max: 3.0 },
        size: { start: 0.2, end: 0.5 },
        color: { start: 0xffff00, end: 0xffffff },
        opacity: { start: 1, end: 0 },
        velocity: new THREE.Vector3(0, 3, 0),
        velocityVariance: new THREE.Vector3(3, 3, 3),
        acceleration: new THREE.Vector3(0, 5, 0),
        gravity: -0.5,
        drag: 0.98,
        rotationSpeed: { min: -5, max: 5 },
        blendMode: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'sphere',
        emitterSize: new THREE.Vector3(1, 2, 1),
        emissionRate: 0,
        emissionBursts: [{ time: 0, count: 50 }],
        loops: false,
        prewarm: false,
      },
      {
        id: 'portal_particles',
        name: 'Portal Particles',
        texture: 'particle/portal.png',
        count: 100,
        lifetime: { min: 0.5, max: 2.0 },
        size: { start: 0.15, end: 0.05 },
        color: { start: 0x8800ff, end: 0x00ffff },
        opacity: { start: 0.7, end: 0 },
        velocity: new THREE.Vector3(0, 0, 0),
        velocityVariance: new THREE.Vector3(1, 2, 1),
        acceleration: new THREE.Vector3(0, 3, 0),
        gravity: -0.2,
        drag: 0.99,
        rotationSpeed: { min: -10, max: 10 },
        blendMode: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        emitterShape: 'box',
        emitterSize: new THREE.Vector3(1, 2, 1),
        emissionRate: 30,
        emissionBursts: [],
        loops: true,
        prewarm: true,
      },
    ];

    for (const config of particles) {
      this.registerParticleConfig(config);
    }
  }

  registerParticleConfig(config: ParticleConfig): void {
    this.configs.set(config.id, config);
  }

  emit(configId: string, position: THREE.Vector3, options?: { count?: number; velocity?: THREE.Vector3 }): void {
    const config = this.configs.get(configId);
    if (!config) {
      console.warn(`Particle config ${configId} not found`);
      return;
    }

    const emitter = new ParticleEmitter(this.scene, config, this.textureLoader);
    emitter.emit(position, options);
    this.particles.set(`${configId}_${Date.now()}_${Math.random()}`, emitter);
  }

  emitAtEntity(configId: string, entity: { position: THREE.Vector3; velocity: THREE.Vector3 }): void {
    this.emit(configId, entity.position, { velocity: entity.velocity });
  }

  update(deltaTime: number): void {
    for (const [id, emitter] of this.particles) {
      emitter.update(deltaTime);
      if (emitter.isDead()) {
        emitter.dispose();
        this.particles.delete(id);
      }
    }
  }

  dispose(): void {
    for (const emitter of this.particles.values()) {
      emitter.dispose();
    }
    this.particles.clear();
    this.configs.clear();
  }
}

class ParticleEmitter {
  private scene: THREE.Scene;
  private config: ParticleConfig;
  private textureLoader: THREE.TextureLoader;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private particles: ParticleData[] = [];
  private time = 0;
  private emissionTimer = 0;
  private burstIndex = 0;
  private isDeadFlag = false;

  constructor(scene: THREE.Scene, config: ParticleConfig, textureLoader: THREE.TextureLoader) {
    this.scene = scene;
    this.config = config;
    this.textureLoader = textureLoader;

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      size: config.size.start,
      vertexColors: true,
      transparent: true,
      opacity: config.opacity.start,
      blending: config.blendMode,
      depthWrite: config.depthWrite,
      depthTest: config.depthTest,
      sizeAttenuation: true,
    });

    if (config.texture) {
      this.material.map = textureLoader.load(config.texture);
    }

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  emit(position: THREE.Vector3, options?: { count?: number; velocity?: THREE.Vector3 }): void {
    const count = options?.count || this.config.count;
    const baseVelocity = options?.velocity || this.config.velocity.clone();

    for (let i = 0; i < count; i++) {
      const particle = this.createParticle(position, baseVelocity);
      this.particles.push(particle);
    }

    this.updateGeometry();
  }

  private createParticle(position: THREE.Vector3, baseVelocity: THREE.Vector3): ParticleData {
    const lifetime = this.config.lifetime.min + Math.random() * (this.config.lifetime.max - this.config.lifetime.min);
    const startColor = new THREE.Color(this.config.color.start);
    const endColor = new THREE.Color(this.config.color.end);
    const startSize = this.config.size.start;
    const endSize = this.config.size.end;
    const startOpacity = this.config.opacity.start;
    const endOpacity = this.config.opacity.end;

    const emitterPos = this.getEmitterPosition(position);

    const velocity = new THREE.Vector3()
      .copy(baseVelocity)
      .add(new THREE.Vector3(
        (Math.random() - 0.5) * 2 * this.config.velocityVariance.x,
        (Math.random() - 0.5) * 2 * this.config.velocityVariance.y,
        (Math.random() - 0.5) * 2 * this.config.velocityVariance.z
      ));

    return {
      position: emitterPos,
      velocity,
      acceleration: this.config.acceleration.clone(),
      lifetime,
      age: 0,
      startColor,
      endColor,
      startSize,
      endSize,
      startOpacity,
      endOpacity,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: this.config.rotationSpeed.min + Math.random() * (this.config.rotationSpeed.max - this.config.rotationSpeed.min),
    };
  }

  private getEmitterPosition(center: THREE.Vector3): THREE.Vector3 {
    const pos = center.clone();
    const size = this.config.emitterSize;

    switch (this.config.emitterShape) {
      case 'point':
        break;
      case 'sphere': {
        const radius = Math.min(size.x, size.y, size.z) * 0.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos.x += Math.sin(phi) * Math.cos(theta) * radius;
        pos.y += Math.cos(phi) * radius;
        pos.z += Math.sin(phi) * Math.sin(theta) * radius;
        break;
      }
      case 'box': {
        pos.x += (Math.random() - 0.5) * size.x;
        pos.y += (Math.random() - 0.5) * size.y;
        pos.z += (Math.random() - 0.5) * size.z;
        break;
      }
      case 'disc': {
        const radius = size.x * 0.5;
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        pos.x += Math.cos(theta) * r;
        pos.z += Math.sin(theta) * r;
        pos.y += (Math.random() - 0.5) * size.y;
        break;
      }
      case 'cone': {
        const height = size.y;
        const radius = size.x * 0.5;
        const h = Math.random() * height;
        const r = (h / height) * radius;
        const theta = Math.random() * Math.PI * 2;
        pos.x += Math.cos(theta) * r;
        pos.z += Math.sin(theta) * r;
        pos.y += h;
        break;
      }
    }

    return pos;
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
    this.emissionTimer += deltaTime;

    if (this.config.emissionRate > 0 && this.config.loops) {
      const emissionInterval = 1 / this.config.emissionRate;
      while (this.emissionTimer >= emissionInterval) {
        this.emit(new THREE.Vector3(), { count: 1 });
        this.emissionTimer -= emissionInterval;
      }
    }

    while (this.burstIndex < this.config.emissionBursts.length) {
      const burst = this.config.emissionBursts[this.burstIndex];
      if (this.time >= burst.time) {
        this.emit(new THREE.Vector3(), { count: burst.count });
        this.burstIndex++;
      } else {
        break;
      }
    }

    let aliveCount = 0;
    for (const particle of this.particles) {
      particle.age += deltaTime;
      if (particle.age < particle.lifetime) {
        aliveCount++;
        const t = particle.age / particle.lifetime;
        
        particle.velocity.addScaledVector(particle.acceleration, deltaTime);
        particle.velocity.y -= this.config.gravity * deltaTime;
        particle.velocity.multiplyScalar(Math.pow(this.config.drag, deltaTime * 60));
        particle.position.addScaledVector(particle.velocity, deltaTime);
        particle.rotation += particle.rotationSpeed * deltaTime;
      }
    }

    if (aliveCount === 0 && this.time > this.config.lifetime.max + 1) {
      this.isDeadFlag = true;
    }

    this.updateGeometry();
  }

  private updateGeometry(): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (const particle of this.particles) {
      if (particle.age >= particle.lifetime) continue;

      const t = particle.age / particle.lifetime;
      
      positions.push(particle.position.x, particle.position.y, particle.position.z);

      const color = particle.startColor.clone().lerp(particle.endColor, t);
      colors.push(color.r, color.g, color.b);

      const size = particle.startSize + (particle.endSize - particle.startSize) * t;
      sizes.push(size);
    }

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    if (positions.length === 0) {
      this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -100, 0], 3));
      this.geometry.setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      this.geometry.setAttribute('size', new THREE.Float32BufferAttribute([0], 1));
    }
  }

  isDead(): boolean {
    return this.isDeadFlag;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    if (this.material.map) this.material.map.dispose();
  }
}

interface ParticleData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  lifetime: number;
  age: number;
  startColor: THREE.Color;
  endColor: THREE.Color;
  startSize: number;
  endSize: number;
  startOpacity: number;
  endOpacity: number;
  rotation: number;
  rotationSpeed: number;
}

export class PostProcessManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private config: PostProcessConfig;
  private composer: any = null;
  private passes: Map<string, any> = new Map();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, config?: Partial<PostProcessConfig>) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = this.getDefaultConfig();
    if (config) this.mergeConfig(config);
  }

  private getDefaultConfig(): PostProcessConfig {
    return {
      enabled: true,
      bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.8 },
      ssao: { enabled: true, radius: 0.5, bias: 0.025, intensity: 1.0 },
      fxaa: { enabled: true },
      colorGrading: { enabled: true, exposure: 1.0, contrast: 1.0, saturation: 1.0, temperature: 0 },
      vignette: { enabled: true, intensity: 0.3, smoothness: 0.5 },
      chromaticAberration: { enabled: false, offset: 0.001 },
    };
  }

  private mergeConfig(config: Partial<PostProcessConfig>): void {
    if (config.bloom) Object.assign(this.config.bloom, config.bloom);
    if (config.ssao) Object.assign(this.config.ssao, config.ssao);
    if (config.fxaa) Object.assign(this.config.fxaa, config.fxaa);
    if (config.colorGrading) Object.assign(this.config.colorGrading, config.colorGrading);
    if (config.vignette) Object.assign(this.config.vignette, config.vignette);
    if (config.chromaticAberration) Object.assign(this.config.chromaticAberration, config.chromaticAberration);
    if (config.enabled !== undefined) this.config.enabled = config.enabled;
  }

  async initialize(): Promise<void> {
    const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
    const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
    const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
    const { SSAOPass } = await import('three/examples/jsm/postprocessing/SSAOPass.js');
    const { ShaderPass } = await import('three/examples/jsm/postprocessing/ShaderPass.js');
    const { FXAAShader } = await import('three/examples/jsm/shaders/FXAAShader.js');
    const { ColorCorrectionShader } = await import('three/examples/jsm/shaders/ColorCorrectionShader.js');

    this.composer = new EffectComposer(this.renderer);
    
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    this.passes.set('render', renderPass);

    if (this.config.bloom.enabled) {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        this.config.bloom.strength,
        this.config.bloom.radius,
        this.config.bloom.threshold
      );
      this.composer.addPass(bloomPass);
      this.passes.set('bloom', bloomPass);
    }

    if (this.config.ssao.enabled) {
      const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
      ssaoPass.kernelRadius = this.config.ssao.radius;
      ssaoPass.minDistance = this.config.ssao.bias;
      ssaoPass.maxDistance = 0.1;
      this.composer.addPass(ssaoPass);
      this.passes.set('ssao', ssaoPass);
    }

    if (this.config.fxaa.enabled) {
      const fxaaPass = new ShaderPass(FXAAShader);
      fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
      this.composer.addPass(fxaaPass);
      this.passes.set('fxaa', fxaaPass);
    }

    if (this.config.colorGrading.enabled) {
      const colorPass = new ShaderPass(ColorCorrectionShader);
      this.updateColorGrading(colorPass);
      this.composer.addPass(colorPass);
      this.passes.set('colorGrading', colorPass);
    }
  }

  private updateColorGrading(pass: any): void {
    const cg = this.config.colorGrading;
    pass.uniforms.exposure.value = cg.exposure;
    pass.uniforms.contrast.value = cg.contrast;
    pass.uniforms.saturation.value = cg.saturation;
    pass.uniforms.temperature.value = cg.temperature;
  }

  render(deltaTime: number): void {
    if (!this.config.enabled || !this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.composer.render(deltaTime);
  }

  setSize(width: number, height: number): void {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    
    const fxaaPass = this.passes.get('fxaa');
    if (fxaaPass) {
      fxaaPass.material.uniforms['resolution'].value.set(1 / width, 1 / height);
    }
  }

  setBloomEnabled(enabled: boolean): void {
    this.config.bloom.enabled = enabled;
    const bloomPass = this.passes.get('bloom');
    if (bloomPass) {
      bloomPass.enabled = enabled;
    }
  }

  setBloomStrength(strength: number): void {
    this.config.bloom.strength = strength;
    const bloomPass = this.passes.get('bloom');
    if (bloomPass) {
      bloomPass.strength = strength;
    }
  }

  setExposure(exposure: number): void {
    this.config.colorGrading.exposure = exposure;
    const colorPass = this.passes.get('colorGrading');
    if (colorPass) {
      colorPass.uniforms.exposure.value = exposure;
    }
  }

  dispose(): void {
    if (this.composer) {
      for (const pass of this.passes.values()) {
        if (pass.dispose) pass.dispose();
      }
      this.passes.clear();
      this.composer = null;
    }
  }
}

export function createMaterialLibrary(): MaterialLibrary {
  return new MaterialLibrary();
}

export function createLightingManager(scene: THREE.Scene, config?: Partial<LightingConfig>): LightingManager {
  return new LightingManager(scene, config);
}

export function createParticleSystem(scene: THREE.Scene): ParticleSystem {
  return new ParticleSystem(scene);
}

export function createPostProcessManager(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  config?: Partial<PostProcessConfig>
): PostProcessManager {
  return new PostProcessManager(renderer, scene, camera, config);
}