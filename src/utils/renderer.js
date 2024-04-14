import * as THREE from "three";

const customRenderer = (windowManager) => {
  const canvas = document.querySelector("canvas.webgl");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: true,
  });

  renderer.target = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight
  );
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

    renderer.target.setSize(
      width * renderer.getPixelRatio(),
      height * renderer.getPixelRatio()
    );
  };

  windowManager.listeners.push(renderer);
  windowManager.update();

  return renderer;
};

export { customRenderer };
