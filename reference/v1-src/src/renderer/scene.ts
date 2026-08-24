import * as THREE from 'three';
import { World } from '../world/world';
import { Player } from '../player/player';
import { CameraController } from '../player/camera-controller';
import { MaterialLibrary, LightingManager, ParticleSystem, PostProcessManager, createMaterialLibrary, createLightingManager, createParticleSystem, createPostProcessManager } from './graphics';

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cameraController: CameraController;
  private renderer: THREE.WebGLRenderer;
  private resizeHandler: () => void;
  
  // Advanced graphics
  private materialLibrary: MaterialLibrary;
  private lightingManager: LightingManager;
  private particleSystem: ParticleSystem;
  private postProcess: PostProcessManager | null = null;
  private usePostProcess = false;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 35, 20);
    this.cameraController = new CameraController(this.camera);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Initialize graphics systems
    this.materialLibrary = createMaterialLibrary();
    this.lightingManager = createLightingManager(this.scene);
    this.particleSystem = createParticleSystem(this.scene);

    // Try to initialize post-processing (optional, for high-end devices)
    this.tryInitPostProcess();

    this.resizeHandler = this.onResize;
    window.addEventListener('resize', this.resizeHandler);
  }

  private async tryInitPostProcess(): Promise<void> {
    try {
      // Check if device can handle post-processing
      const gl = this.renderer.getContext();
      const isHighEnd = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 2048 && 
                        navigator.hardwareConcurrency >= 4;
      
      if (isHighEnd) {
        this.postProcess = await createPostProcessManager(
          this.renderer,
          this.scene,
          this.camera
        );
        await this.postProcess.initialize();
        this.usePostProcess = true;
        console.log('Post-processing enabled');
      }
    } catch (error) {
      console.warn('Post-processing not available:', error);
      this.usePostProcess = false;
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  getMaterialLibrary(): MaterialLibrary {
    return this.materialLibrary;
  }

  getLightingManager(): LightingManager {
    return this.lightingManager;
  }

  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  render(world: World, player: Player, deltaTime: number = 1/60) {
    this.cameraController.update(player.position);
    
    // Update graphics systems
    this.lightingManager.update(deltaTime, player.position);
    this.particleSystem.update(deltaTime);

    if (this.usePostProcess && this.postProcess) {
      this.postProcess.render(deltaTime);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    window.removeEventListener('resize', this.resizeHandler);
    this.cameraController.dispose();
    this.materialLibrary.dispose();
    this.lightingManager.dispose();
    this.particleSystem.dispose();
    
    if (this.postProcess) {
      this.postProcess.dispose();
    }
    
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private onResize = () => {
    const container = this.renderer.domElement.parentElement!;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    
    if (this.postProcess) {
      this.postProcess.setSize(container.clientWidth, container.clientHeight);
    }
  };
}