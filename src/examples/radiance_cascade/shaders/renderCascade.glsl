uniform sampler2D tPrevCascade;

varying vec2 vUv;

out vec4 outColor;

vec2 cascadeUvOffset(int cascadeIndex) {
  return vec2(0.25 * float(cascadeIndex), 0.);
}

vec2 sampleUvMapped(vec2 sampleUv) {
  vec2 fuv = fwidth(vUv);
  vec2 minUvRemap = 0.5  * fuv;
  vec2 maxUvRemap = 1. - minUvRemap;
  vec2 zeroToOne = sampleUv / (maxUvRemap - minUvRemap);
  vec2 delta = 1. / vec2(textureSize(tPrevCascade, 0));
  vec2 newMax = vec2(0.25, 1.) - 0.5 * delta;
  vec2 newMin = 0.5 * delta + vec2(0.,0.5);
  return zeroToOne * (newMax - newMin) + newMin;
}

vec4 radiance(vec2 uv) {
  vec4 rad = vec4(0.);
  vec2 remapped = sampleUvMapped(uv);
  for (int i = 0; i < 4; i++) {
    vec2 offsetUv = cascadeUvOffset(i) + remapped;
    rad += texture2D(tPrevCascade, offsetUv);
  }
  return rad / 4.;
}

void main() {
  outColor = radiance(vUv);
  outColor.w = 1.;
}
