#version 300 es
struct DebugInfo {
  bool continousBilinearFix;
  bool cornerProbes;
  bool showSampleUv;
  bool showProbeUv;
  bool showDirection;
  bool noFix;
  bool quadSample;
};

precision mediump float;
uniform sampler2D tPrevCascade;
uniform vec2 resolution;
uniform DebugInfo debug;

out vec4 outColor;

vec2 cascadeUvOffset(int cascadeIndex) {
  return vec2(0.5 * float(cascadeIndex / 2), 0.5 * mod(float(cascadeIndex), 2.));
}

vec2 sampleUvMapped(vec2 sampleUv) {
  vec2 fuv = fwidth(sampleUv);
  vec2 minUvRemap = 0.5  * fuv;
  vec2 maxUvRemap = 1. - minUvRemap;
  vec2 zeroToOne = (sampleUv - minUvRemap) / (maxUvRemap - minUvRemap);
  vec2 delta = 1. / vec2(textureSize(tPrevCascade, 0));
  vec2 newMax = vec2(0.5 - delta) ;
  vec2 newMin = delta;
  return zeroToOne * (newMax - newMin) + newMin;
}

vec4 radiance(vec2 uv) {
  vec4 rad = vec4(0.);
  vec2 remapped = sampleUvMapped(uv);
  for (int i = 0; i < 4; i++) {
    vec2 offsetUv = cascadeUvOffset(i) + remapped;
    rad += texture(tPrevCascade, offsetUv);
  }
  return rad / 4.;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  outColor = radiance(uv);
  outColor.w = 1.;
}
