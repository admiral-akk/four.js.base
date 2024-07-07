import {
  WebGLRenderTarget,
  Vector2,
  DepthTexture,
  DepthStencilFormat,
  UnsignedInt248Type,
  PCFSoftShadowMap,
  WebGLRenderer,
} from "three";

const _vector2 = new Vector2();

class ScaledRenderTarget extends WebGLRenderTarget {
  constructor(renderer, ratio, options) {
    super(1, 1, options);
    this.ratio = ratio;
    this.renderer = renderer;
    this.updateSize();
  }

  updateSize() {
    this.renderer.getSize(_vector2);
    const pixelRatio = this.renderer.getPixelRatio();
    this.setSize(
      _vector2.x * this.ratio * pixelRatio,
      _vector2.y * this.ratio * pixelRatio
    );
  }
}

const customRenderer = (windowManager) => {
  const canvas = document.querySelector("canvas.webgl");
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: true,
  });

  renderer.renderTargets = [];
  renderer.newRenderTarget = (ratio = 1, config = {}) => {
    const renderTarget = new ScaledRenderTarget(renderer, ratio, config);
    renderer.renderTargets.push(renderTarget);
    return renderTarget;
  };

  renderer.target = renderer.newRenderTarget(1, 1);
  const format = DepthStencilFormat;
  renderer.target.depthTexture = new DepthTexture();
  renderer.target.stencilBuffer = format === DepthStencilFormat ? true : false;
  renderer.target.format = format;
  renderer.target.type = UnsignedInt248Type;

  renderer.setClearColor("#201919");
  renderer.setClearAlpha(0);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  renderer.updateSize = ({ width, height }) => {
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.renderTargets.forEach((rt) => {
      rt.updateSize();
    });
  };

  windowManager.listeners.push(renderer);
  windowManager.update();

  return renderer;
};

export { customRenderer };
