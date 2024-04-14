import "./style.css";
import * as THREE from "three";
import { TimeManager } from "./utils/time.js";
import { WindowManager } from "./utils/window.js";
import { customRenderer } from "./utils/renderer.js";
import { generateCamera, cameraConfig } from "./utils/camera.js";
import Stats from "stats-js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { generateLoadingManager } from "./utils/loader.js";
import { basicCustomShader } from "./utils/basicCustomShader.js";
import { InputManager } from "./utils/input.js";

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const time = new TimeManager();
const scene = new THREE.Scene();
const loader = generateLoadingManager();
const input = new InputManager(time);

const camera = generateCamera(scene, cameraConfig);
const windowManager = new WindowManager(camera);
const renderer = customRenderer(windowManager);

class Game {
  constructor(scene) {
    this.scene = scene;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x5bbcff })
    );
    box.position.set(0, 1, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshBasicMaterial({ color: 0x5bbcff })
    );
    sphere.position.set(2, 2, 2);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    plane.castShadow = true;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
    const light = new THREE.DirectionalLight(0xffffff, 10);
    light.position.set(100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 200.0;
    light.shadow.camera.left = -20.0;
    light.shadow.camera.right = 20.0;
    light.shadow.camera.top = 20.0;
    light.shadow.camera.bottom = -20.0;
    scene.add(light);

    this.box = box;
  }

  update(time) {
    this.box.setRotationFromEuler(new THREE.Euler(0, time.time.gameTime, 0));
  }
}

const game = new Game(scene);

const postProcessing = (uniforms, fragShader) => {
  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: `
    #include <packing>
    varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
    fragmentShader: fragShader,
  });
};

const sobelFragShader = `
#include <packing>

uniform float cameraNear;
uniform float cameraFar;

uniform float textureWidth;
uniform float textureHeight;

uniform float pixelWidth;

uniform vec3 cameraDir;
uniform vec3 cameraUp;
uniform vec3 cameraRight;

uniform sampler2D tDepth;
uniform sampler2D tNormal;

uniform float fov;
uniform float aspect;

varying vec2 vUv;

float readDepth( sampler2D depthSampler, vec2 coord ) {
    float fragCoordZ = texture2D( depthSampler, coord ).x;
    float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar);
    return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
 }
 
 float linearize_depth(in float depth){
     float a = cameraFar / (cameraFar - cameraNear);
     float b = cameraFar * cameraNear / (cameraNear - cameraFar);
     return a + b / depth;
 }
 
 float reconstruct_depth(const in vec2 uv){
     float depth = texture2D(tDepth, uv).x;
     return pow(2.0, depth * log2(cameraFar + 1.0)) - 1.0;
 }
 
 float dotM(mat3 matrix1, mat3 matrix2) {
    return dot(matrix1[0], matrix2[0])
       + dot(matrix1[1], matrix2[1])
       + dot(matrix1[2], matrix2[2]);
 } 
 
 float sobelM(mat3 values) {
             const mat3 Gx = mat3( -3, -10, -3, 0, 0, 0, 3, 10, 3 ); // x direction kernel
             const mat3 Gy = mat3( -3, 0, 3, -10, 0, 10, -3, 0, 3 ); // y direction kernel
 
          float dx = dotM(values, Gx);
          float dy = dotM(values, Gy);
 
             return ( dx*dx ) + ( dy * dy );
 }

 void main()
 {  
    vec2 texel = pixelWidth * vec2( 1.0 / textureWidth, 1.0 / textureHeight );
 
    vec3 normal = texture2D(tNormal, vUv ).rgb;
    vec3 n = texture2D(tNormal, vUv + vec2(0.0, -texel.y)).rgb;
    vec3 s = texture2D(tNormal, vUv + vec2(0.0, texel.y)).rgb;
    vec3 e = texture2D(tNormal, vUv + vec2(texel.x, 0.0)).rgb;
    vec3 w = texture2D(tNormal, vUv + vec2(-texel.x, 0.0)).rgb;
    vec3 nw = texture2D(tNormal, vUv + vec2(-texel.x, -texel.y)).rgb;
    vec3 ne = texture2D(tNormal, vUv + vec2(texel.x, -texel.y)).rgb;
    vec3 sw = texture2D(tNormal, vUv + vec2(-texel.x, texel.y)).rgb;
    vec3 se = texture2D(tNormal, vUv + vec2(texel.x, texel.y)).rgb;
 
    mat3 normal_r =  mat3(
       vec3(nw.r, n.r, ne.r),
       vec3(w.r, normal.r, e.r),
       vec3(sw.r, s.r, se.r)
    );
    mat3 normal_g =   mat3(
       vec3(nw.g, n.g, ne.g),
       vec3(w.g, normal.g, e.g),
       vec3(sw.g, s.g, se.g)
    );
    mat3 normal_b = mat3(
       vec3(nw.b, n.b, ne.b),
       vec3(w.b, normal.b, e.b),
       vec3(sw.b, s.b, se.b)
    );
 
 
    float tx0y0 = reconstruct_depth( vUv + texel * vec2( -1, -1 ) );
    float tx0y1 = reconstruct_depth( vUv + texel * vec2( -1,  0 ) );
    float tx0y2 = reconstruct_depth( vUv + texel * vec2( -1,  1 ) );
    // second column  
 
    float tx1y0 = reconstruct_depth( vUv + texel * vec2(  0, -1 ) );
    float tx1y1 = reconstruct_depth( vUv + texel * vec2(  0,  0 ) );
    float tx1y2 = reconstruct_depth( vUv + texel * vec2(  0,  1 ) );
 
    // third column
 
    float tx2y0 = reconstruct_depth( vUv + texel * vec2(  1, -1 ) );
    float tx2y1 = reconstruct_depth( vUv + texel * vec2(  1,  0 ) );
    float tx2y2 = reconstruct_depth( vUv + texel * vec2(  1,  1 ) );
    
    mat3 mat_depth = mat3(
       vec3(tx0y0, tx1y0,tx2y0),
       vec3(tx1y0, tx1y1, tx1y2),
       vec3(tx2y0, tx2y1,tx2y2)
    ) / cameraFar;
 
    vec3 fixedNormal = normalize(normal - 0.5);
    vec3 fixedCameraDir = normalize(cameraDir) 
       + cameraRight * tan(aspect * fov * (vUv.x - 0.5));
       + cameraUp * tan( fov * (vUv.y - 0.5));
 
    // For each pixel movement, how far do I move along the surface?
    float stepSize = abs(1. - dot(fixedNormal, normalize(fixedCameraDir)));
 
    vec3 sobelNormal = vec3(sobelM(normal_r),sobelM(normal_g),sobelM(normal_b));
    
    float sobelDepth = sobelM(mat_depth);
 
    float edgeValue = dot(vec3(1.), sobelNormal) / 10. + sobelDepth / stepSize ;
    float sobel = step( 0.15, edgeValue);
 
    gl_FragColor = vec4(sobel);
 }
`;

const fillFragShader = `
uniform sampler2D tInput;

uniform float textureWidth;
uniform float textureHeight;

uniform float xPixelJump;
uniform float yPixelJump;

varying vec2 vUv;

 void main()
 {  
    vec2 offset = vec2(xPixelJump / textureWidth, yPixelJump / textureHeight);
    vec4 left =  texture2D(tInput, vUv - offset);
    vec4 middle =  texture2D(tInput, vUv);
    vec4 right =  texture2D(tInput, vUv + offset);
 
    gl_FragColor = max(max(left, right), middle);
 }

`;

const crossHatchFrag = `
uniform sampler2D tShadow;

uniform float textureWidth;
uniform float textureHeight;

uniform float thickness;
uniform float scale;
uniform float frequency;

varying vec2 vUv;

float htex(in vec2 p, in float lum ) { 
    float e = thickness * length(vec2(dFdx(p.x), dFdy(p.y))); 
   
  if (lum < 0.5) {
    float v = abs(mod(p.x + p.y, 10.0));
    if (v < e) {
      return 0.;
    }
  }
  
  if (lum < 0.4) {
    float v = abs(mod(p.x - p.y, 10.0));
    if (v < e) {
      return 0.;
    }
  }
  
  if (lum < 0.3) {
    float v = abs(mod(p.x + p.y - 5.0, 10.0));
    if (v < e) {
      return 0.;
    }
  }
  
  if (lum < 0.2) {
    float v = abs(mod(p.x - p.y - 5.0, 10.0));
    if (v < e) {
      return 0.;
    }
  }

  if (lum < 0.1) {
    float v = abs(mod(p.x + p.y - 7.5, 10.0));
    if (v < e) {
      return 0.;
    }
  }
 
  return 1.;
}

void main()
{
    vec2 size = vec2(textureSize(tShadow, 0));
   float lum = texture2D(tShadow, vUv).r;
   float isHatch =  1. - htex(vUv * size * scale ,lum);
   gl_FragColor = vec4(isHatch);
}

`;

const combineFragShader = `
uniform sampler2D tDiffuse;
uniform sampler2D tSobel;
uniform sampler2D tHatch;

varying vec2 vUv;

 void main()
 {  
    vec4 diffuse = texture2D(tDiffuse, vUv);
    vec4 sobel = texture2D(tSobel, vUv);
    vec4 hatch = texture2D(tHatch, vUv);

    float sobelMask = (1. - step( sobel.a, 0.2));
    float hatchMask = (1. - step( hatch.a, 0.2));
 
    vec3 color = (1. - sobelMask) * (1. - hatchMask) * diffuse.rgb;
 
    gl_FragColor = vec4(color, 1.);
 }
`;

const renderTextureFrag = `
uniform sampler2D tInput;

varying vec2 vUv;

 void main()
 {  
    gl_FragColor = texture2D(vUv, tInput);
 }
`;
class RenderPipeline {
  constructor(renderer) {
    this.renderer = renderer;

    this.normalTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );
    this.normalTarget.depthTexture = new THREE.DepthTexture();

    this.diffuseTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );

    this.sobelTexture = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );

    this.tempBuffer = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );

    this.shadowTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );
  }

  updateSize({ width, height }) {
    const setTextureSize = (texture) => {
      texture.setSize(
        width * this.renderer.getPixelRatio(),
        height * this.renderer.getPixelRatio()
      );
    };
    setTextureSize(this.normalTarget);
    setTextureSize(this.diffuseTarget);
    setTextureSize(this.sobelTexture);
    setTextureSize(this.tempBuffer);
    setTextureSize(this.shadowTarget);
  }

  renderOverride(scene, camera, material, target) {
    const oldTarget = this.renderer.getRenderTarget();
    const oldOverride = scene.overrideMaterial;

    scene.overrideMaterial = material;
    this.renderer.setRenderTarget(target);

    renderer.render(scene, camera);

    scene.overrideMaterial = oldOverride;
    this.renderer.setRenderTarget(oldTarget);
  }

  render(scene, camera) {
    // Render normals + depth
    this.renderOverride(
      scene,
      camera,
      new THREE.MeshNormalMaterial(),
      this.normalTarget
    );
    this.renderOverride(scene, camera, null, this.diffuseTarget);
    this.renderOverride(
      scene,
      camera,
      new THREE.ShaderMaterial({
        ...basicCustomShader,
        fog: true,
        lights: true,
      }),
      this.shadowTarget
    );

    var v = new THREE.Vector3(0, 0, -1);
    var u = new THREE.Vector3(0, 1, 0);
    var r = new THREE.Vector3(1, 0, 0);

    v.applyQuaternion(camera.quaternion);
    u.applyQuaternion(camera.quaternion);
    r.applyQuaternion(camera.quaternion);

    const sobelFilter = new FullScreenQuad(
      postProcessing(
        {
          textureWidth: { value: this.normalTarget.width },
          textureHeight: { value: this.normalTarget.height },
          cameraDir: { value: v },
          cameraUp: { value: u },
          cameraRight: { value: r },
          pixelWidth: { value: 4 },
          cameraNear: { value: camera.near },
          cameraFar: { value: camera.far },
          tNormal: { value: this.normalTarget.texture },
          tDepth: { value: this.normalTarget.depthTexture },
        },
        sobelFragShader
      )
    );

    this.renderer.setRenderTarget(this.sobelTexture);
    sobelFilter.render(this.renderer);

    for (let i = -1; i >= 0; i--) {
      const xPass = new FullScreenQuad(
        postProcessing(
          {
            textureWidth: { value: this.normalTarget.width },
            textureHeight: { value: this.normalTarget.height },
            xPixelJump: { value: 1 << i },
            yPixelJump: { value: 0 },
            tInput: { value: this.sobelTexture.texture },
          },
          fillFragShader
        )
      );
      this.renderer.setRenderTarget(this.tempBuffer);
      xPass.render(this.renderer);

      const yPass = new FullScreenQuad(
        postProcessing(
          {
            textureWidth: { value: this.normalTarget.width },
            textureHeight: { value: this.normalTarget.height },
            xPixelJump: { value: 0 },
            yPixelJump: { value: 1 },
            tInput: { value: this.tempBuffer.texture },
          },
          fillFragShader
        )
      );
      this.renderer.setRenderTarget(this.sobelTexture);
      yPass.render(this.renderer);
    }

    const renderTexturePass = new FullScreenQuad(
      postProcessing(
        {
          textureWidth: { value: this.normalTarget.width },
          textureHeight: { value: this.normalTarget.height },
          thickness: { value: 1 },
          scale: { value: 0.2 },
          frequency: { value: 50 },
          tShadow: { value: this.shadowTarget.texture },
        },
        crossHatchFrag
      )
    );
    this.renderer.setRenderTarget(this.tempBuffer);
    renderTexturePass.render(this.renderer);

    const combinePass = new FullScreenQuad(
      postProcessing(
        {
          tDiffuse: { value: this.diffuseTarget.texture },
          tSobel: { value: this.sobelTexture.texture },
          tHatch: { value: this.tempBuffer.texture },
        },
        combineFragShader
      )
    );
    this.renderer.setRenderTarget(null);
    combinePass.render(this.renderer);
  }
}

const pipeline = new RenderPipeline(renderer);
windowManager.listeners.push(pipeline);

function raf() {
  pipeline.render(scene, camera);
  time.tick();
  game.update(time);
  window.requestAnimationFrame(raf);
}

window.requestAnimationFrame(raf);
