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

class RenderTarget extends WebGLRenderTarget {
  constructor(width, height, options) {
    super(width, height, options);
  }

  updateSize(renderer, ratio) {
    renderer.getSize(_vector2);
    const pixelRatio = renderer.getPixelRatio();
    this.setSize(
      _vector2.x * ratio * pixelRatio,
      _vector2.y * ratio * pixelRatio
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
  renderer.newRenderTarget = (widthRatio, heightRatio, config = {}) => {
    const renderTarget = new RenderTarget(1, 1, config);
    renderTarget.updateSize(renderer, widthRatio);
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
      rt.updateSize(renderer, 1);
    });
  };

  windowManager.listeners.push(renderer);
  windowManager.update();

  return renderer;
};

export { customRenderer };
