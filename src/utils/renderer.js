import {
  WebGLRenderTarget,
  Vector2,
  PCFSoftShadowMap,
  WebGLRenderer,
} from "three";

const _vector2 = new Vector2();

class ScaledRenderTarget extends WebGLRenderTarget {
  constructor(renderer, ratio, options) {
    super(1, 1, options);
    this.ratio = ratio;
    this.updateSize(renderer);
  }

  updateSize(renderer) {
    renderer.getSize(_vector2);
    const pixelRatio = renderer.getPixelRatio();
    this.setSize(
      _vector2.x * this.ratio * pixelRatio,
      _vector2.y * this.ratio * pixelRatio
    );
  }
}

class CustomerRenderer extends WebGLRenderer {
  constructor(windowManager) {
    const canvas = document.querySelector("canvas.webgl");
    super({
      canvas,
      antialias: true,
      logarithmicDepthBuffer: true,
    });
    this.renderTargets = [];

    this.setClearColor("#201919");
    this.setClearAlpha(0);

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

  updateSize({ width, height }) {
    this.setSize(width, height);
    this.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderTargets.forEach((rt) => {
      rt.updateSize(renderer);
    });
  }
}

export { CustomerRenderer };
