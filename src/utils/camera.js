import * as THREE from "three";

const perspectiveConfig = {
  type: "perspective",
  fov: 75,
  zoom: 6,
};

const orthographicConfig = {
  type: "orthographic",
  zoom: 6,
};

const cameraConfig = {
  subtypeConfig: perspectiveConfig,
  aspectRatio: 16 / 9,
  near: 0.001,
  far: 40.0,
  position: new THREE.Vector3(-5, 7, 5)
    .normalize()
    .multiplyScalar(perspectiveConfig.zoom),
};

const generateCamera = (
  scene,
  { aspectRatio, subtypeConfig, near, far, position }
) => {
  let camera;
  switch (subtypeConfig.type) {
    case "perspective":
      camera = new THREE.PerspectiveCamera(
        subtypeConfig.fov,
        cameraConfig.aspectRatio
      );
      camera.customZoom = subtypeConfig.zoom;
      break;
    case "orthographic":
      const height = subtypeConfig.zoom;
      const width = aspectRatio * height;

      camera = new THREE.OrthographicCamera(
        -width / 2,
        width / 2,
        height / 2,
        -height / 2,
        near
      );
      camera.customZoom = subtypeConfig.zoom;
      break;
    default:
      throw new Error("unknown camera type");
  }
  camera.position.x = position.x;
  camera.position.y = position.y;
  camera.position.z = position.z;

  camera.aspect = aspectRatio;
  camera.near = near;
  camera.far = far;
  camera.lookAt(new THREE.Vector3());
  scene.add(camera);

  camera.updateZoom = () => {
    const { customZoom, aspect } = camera;
    if (camera.isOrthographicCamera) {
      const height = customZoom;
      const width = aspect * height;

      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
    } else if (camera.isPerspectiveCamera) {
      camera.position.multiplyScalar(customZoom / camera.position.length());
    }
    camera.updateProjectionMatrix();
  };

  camera.generateCameraUniforms = () => {
    var v = new THREE.Vector3(0, 0, -1);
    var u = new THREE.Vector3(0, 1, 0);
    var r = new THREE.Vector3(1, 0, 0);

    v.applyQuaternion(camera.quaternion);
    u.applyQuaternion(camera.quaternion);
    r.applyQuaternion(camera.quaternion);

    return {
      cameraDir: { value: v },
      cameraUp: { value: u },
      cameraRight: { value: r },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
    };
  };

  return camera;
};

export { generateCamera, cameraConfig };
