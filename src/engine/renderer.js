import {
  WebGLRenderTarget,
  Vector2,
  PCFSoftShadowMap,
  WebGLRenderer,
  ShaderMaterial,
  GLSL3,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

const _vector2 = new Vector2();

class ScaledRenderTarget extends WebGLRenderTarget {
  constructor(renderer, ratio, options) {
    super(1, 1, options);
    this.ratio = ratio;
    if (options.fixedSize) {
      this.fixedSize = options.fixedSize;
    }
    this.updateSize(renderer);
  }

  updateSize(renderer) {
    if (this.fixedSize) {
      this.setSize(this.fixedSize.x, this.fixedSize.y);
    } else {
      renderer.getSize(_vector2);
      const pixelRatio = renderer.getPixelRatio();
      this.setSize(
        _vector2.x * this.ratio * pixelRatio,
        _vector2.y * this.ratio * pixelRatio
      );
    }
  }
}
class CustomerRenderer extends WebGLRenderer {
  constructor(windowManager) {
    const canvas = document.querySelector("canvas.webgl");
    super({
      canvas,
      antialias: false,
      logarithmicDepthBuffer: true,
    });
    this.renderTargets = [];

    this.setClearColor("#201919");
    this.setClearAlpha(0);
    this.fps = 60;

    this.shadowMap.enabled = true;
    this.shadowMap.type = PCFSoftShadowMap;
    windowManager.listeners.push(this);
    windowManager.update();
  }

  newRenderTarget(ratio = 1, config = {}) {
    const len = this.renderTargets.push(
      new ScaledRenderTarget(this, ratio, config)
    );
    return this.renderTargets[len - 1];
  }

  refreshSize() {
    const size = new Vector2();
    this.getSize(size);
    this.updateSize({ width: size.x, height: size.y });
  }

  updateSize({ width, height }) {
    this.setSize(width, height);
    this.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderTargets.forEach((rt) => {
      rt.updateSize(this);
    });
  }

  renderOverride(scene, camera, material, target) {
    const oldTarget = this.getRenderTarget();
    const oldOverride = scene.overrideMaterial;

    scene.overrideMaterial = material;
    this.setRenderTarget(target);

    this.render(scene, camera);

    scene.overrideMaterial = oldOverride;
    this.setRenderTarget(oldTarget);
  }

  renderTexture(rt) {
    this.applyPostProcess(
      {
        tInput: rt,
      },
      `
          uniform sampler2D tInput;
          varying vec2 vUv; 
          out vec4 outColor;
          void main() {  
            outColor = texture2D(tInput, vUv); 
            outColor = pow(outColor, vec4(1. / 2.2));
          }`,
      null
    );
  }

  setTextureToConstant(rt, constant) {
    this.applyPostProcess(
      { constant: constant },
      `
        uniform vec4 constant;
        out vec4 outColor;
        void main() {  outColor = constant; }`,
      rt
    );
  }

  applyPostProcess(uniforms, fragShader, outputBuffer, defines = null) {
    for (const key in uniforms) {
      const value = uniforms[key];
      if (!value.hasOwnProperty("value")) {
        uniforms[key] = { value: value };
      }
    }

    for (const key in uniforms) {
      const valueWrapper = uniforms[key];
      if (
        Object.getPrototypeOf(valueWrapper.value).constructor ===
        ScaledRenderTarget
      ) {
        valueWrapper.value = valueWrapper.value.texture;
      }
    }
    const mat = new ShaderMaterial({
      uniforms: uniforms,
      vertexShader: `
      varying vec2 vUv;
  
      void main() {
  
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  
      }`,
      fragmentShader: fragShader,
      glslVersion: GLSL3,
    });
    mat.defines = defines;
    const gradientPass = new FullScreenQuad(mat);
    const temp = this.getRenderTarget();
    this.setRenderTarget(outputBuffer);
    gradientPass.render(this);
    this.setRenderTarget(temp);
  }
}

export { CustomerRenderer };
