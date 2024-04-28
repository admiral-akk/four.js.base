import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

function generateLoadingManager(
  onLoad = () => {
    console.log("ON LOAD");
  },
  onProgress = (url, itemsLoaded, itemsTotal) => {
    console.log("ON PROGRESS: ", url, itemsLoaded, itemsTotal);
  },
  onError = (url) => {
    console.log("ON ERROR: ", url);
  }
) {
  const loadingManager = new THREE.LoadingManager(onLoad, onProgress, onError);

  const dracoLoader = new DRACOLoader(loadingManager);
  const gltfLoader = new GLTFLoader(loadingManager);
  gltfLoader.setDRACOLoader(dracoLoader);
  dracoLoader.setDecoderPath("./draco/gltf/");

  loadingManager.cubeTextureLoader = new THREE.CubeTextureLoader(
    loadingManager
  );
  loadingManager.textLoader = new THREE.FileLoader();
  loadingManager.textureLoader = new THREE.TextureLoader(loadingManager);
  loadingManager.RGBELoader = new RGBELoader(loadingManager);
  loadingManager.audioLoader = new THREE.AudioLoader(loadingManager);
  loadingManager.fontLoader = new FontLoader(loadingManager);

  loadingManager.loadedStuff = new Map();

  loadingManager.load = (path, callback = null) => {
    if (loadingManager.loadedStuff.has(path)) {
      const reference = loadingManager.loadedStuff.get(path);
      if (callback) {
        callback(reference.value);
      }
      return reference;
    }

    const reference = {};
    loadingManager.loadedStuff.set(path, reference);

    const loadingType = path.split("/")[1];
    switch (loadingType) {
      case "text":
        reference.value = loadingManager.textLoader.load(
          path,
          callback ?? (() => {})
        );
        break;
      case "cubeTexture":
        reference.value = loadingManager.cubeTextureLoader.load(
          [
            "/px.png",
            "/nx.png",
            "/py.png",
            "/ny.png",
            "/pz.png",
            `/nz.png`,
          ].map((n) => path + n)
        );
        break;

      case "texture":
        const isHdr = path.match(/\.hdr/g);
        reference.value = (
          isHdr ? loadingManager.RGBELoader : loadingManager.textureLoader
        ).load(path, callback ?? (() => {}));
        break;

      case "font":
        loadingManager.fontLoader.load(path, (font) => {
          reference.value = font;
          if (callback) {
            callback(font);
          }
        });
        break;

      case "audio":
        loadingManager.audioLoader.load(path, (buffer) => {
          reference.value = buffer;
          if (callback) {
            callback(buffer);
          }
        });
        break;

      case "model":
        gltfLoader.load(path, (data) => {
          const model = data.scene;
          console.log(model);
          model.animations = data.animations;
          reference.value = model;
          if (callback) {
            callback(model);
          }
        });
        break;

      default:
        throw new Error("Unknown type, path: " + path);
    }

    return reference;
  };

  return loadingManager;
}

export { generateLoadingManager };
