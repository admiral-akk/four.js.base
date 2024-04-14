import { mergeUniforms } from "three/src/renderers/shaders/UniformsUtils.js";
import { UniformsLib } from "three/src/renderers/shaders/UniformsLib.js";

const basicCustomShader = {
  uniforms: mergeUniforms([UniformsLib.lights]),

  vertexShader: `
  #include <common>
  #include <shadowmap_pars_vertex>
  
  varying vec3 vNormal;
  
  // Transformation described here: https://stackoverflow.com/questions/29879216/preparing-model-view-and-projection-matrices-for-glsl
  // Variables described here: https://www.khronos.org/opengl/wiki/Built-in_Variable_(GLSL)
  void main() {
      #include <beginnormal_vertex>
      #include <defaultnormal_vertex>
  
      #include <begin_vertex>
  
      #include <worldpos_vertex>
      #include <shadowmap_vertex>
      vec4 objectPos = vec4(position, 1.);
      // Moves it into world space. Includes object rotations, scale, and translation.
      vec4 worldPos = modelMatrix * objectPos;
      // Applies view (moves it relative to camera position/orientation)
      vec4 viewPos = viewMatrix * worldPos;
      // Applies projection (orthographic/perspective)
      vec4 projectionPos = projectionMatrix * viewPos;
      gl_Position = projectionPos;
      vNormal = normalize(normalMatrix  * normal);
  }
  `,

  fragmentShader: `
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  
  varying vec3 vNormal;
  
  // Variables described here: https://www.khronos.org/opengl/wiki/Built-in_Variable_(GLSL)
  void main()
  {
    // shadow map
    DirectionalLightShadow directionalShadow = directionalLightShadows[0];
  
    float shadow = getShadow(
      directionalShadowMap[0],
      directionalShadow.shadowMapSize,
      directionalShadow.shadowBias,
      directionalShadow.shadowRadius,
      vDirectionalShadowCoord[0]
    );
    float NdotL = dot(vNormal, directionalLights[0].direction);
    float val = clamp(NdotL*shadow, 0., 1.);
    gl_FragColor = vec4(val);
  }
  `,
};

export { basicCustomShader };
