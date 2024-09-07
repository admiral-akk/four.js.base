uniform sampler2D tCascadeZero;

uniform int sqrtBaseRayCount;
uniform int baseRayCount;

uniform float minUvRemap;
uniform float maxUvRemap;

varying vec2 vUv;

out vec4 outColor;

vec2 cascadeUvOffset(int cascadeIndex) {
  float indexCount = float(sqrtBaseRayCount);
  float x = mod(float(cascadeIndex), indexCount);
  float y = float(cascadeIndex / sqrtBaseRayCount);
  return vec2(x, y) / indexCount;
}

void sampleUvMapped(inout vec2 sampleUv) {
  sampleUv = minUvRemap + (maxUvRemap - minUvRemap) * sampleUv;
}

vec4 radiance(vec2 uv) {
  vec4 rad = vec4(0.);
  sampleUvMapped(uv);
  for (int i = 0; i < baseRayCount; i++) {
    vec2 offsetUv = cascadeUvOffset(i) + uv;
    rad += texture2D(tCascadeZero, offsetUv);
  }
  return rad / float(baseRayCount);
}

  void main() {
    outColor = radiance(vUv);
  }
