import * as THREE from "three";

const customRenderer = (windowManager) => {
  const canvas = document.querySelector("canvas.webgl");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: true,
  });

  renderer.renderTargets = [];
  renderer.newRenderTarget = (widthRatio, heightRatio, config = {}) => {
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, config);
    renderTarget.updateSize = () => {
      const size = new THREE.Vector2();
      renderer.getSize(size);
      const pixelRatio = renderer.getPixelRatio();
      renderTarget.setSize(
        size.x * widthRatio * pixelRatio,
        size.y * heightRatio * pixelRatio
      );
    };
    renderTarget.updateSize();
    renderer.renderTargets.push(renderTarget);
    return renderTarget;
  };

  renderer.target = renderer.newRenderTarget(1, 1);
  const format = THREE.DepthStencilFormat;
  renderer.target.depthTexture = new THREE.DepthTexture();
  renderer.target.stencilBuffer =
    format === THREE.DepthStencilFormat ? true : false;
  renderer.target.format = format;
  renderer.target.type = THREE.UnsignedInt248Type;

  renderer.setClearColor("#201919");

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
