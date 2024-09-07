#define M_PI 3.1415926538
#define TAU 6.283185307179586

uniform sampler2D tCascadeZero;

// the ray count at cascadeDepth = 0;
uniform int sqrtBaseRayCount;
uniform int baseRayCount;

varying vec2 vUv;

out vec4 outColor;

vec2 uvOffset(int index) {
  vec2 dim = 0.5 / vec2(textureSize(tCascadeZero, 0));
  float xOffset = clamp(floor(mod(float(index), float(sqrtBaseRayCount))), 0., float(sqrtBaseRayCount));
  float yOffset = clamp(floor(float(index) / float(sqrtBaseRayCount)), 0., float(sqrtBaseRayCount));
  return dim + (vec2(xOffset, yOffset)) /  float(sqrtBaseRayCount);
}

vec4 radiance(vec2 uv) {
  vec4 rad = vec4(0.);
  vec2 dim = 1. / vec2(textureSize(tCascadeZero, 0));
  for (int i = 0; i < baseRayCount; i++) {
    vec2 adjustedUv = uv / (float(sqrtBaseRayCount)) - dim;
    vec2 offsetUv = uvOffset(i) + adjustedUv;
    rad += texture2D(tCascadeZero, offsetUv);
  }
  return rad / float(baseRayCount);
}

  void main() {
    outColor = radiance(vUv);
  }
