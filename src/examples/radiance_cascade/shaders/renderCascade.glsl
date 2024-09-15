uniform sampler2D tPrevCascade;

struct CascadeConfig { 
  float probeCount;
  float depth;
  float rayCount;
  int xSize;
  float minDistance;
  float maxDistance;
};

uniform CascadeConfig current;

varying vec2 vUv;

out vec4 outColor;

vec2 cascadeUvOffset(int cascadeIndex) {
  float sqrtBaseRayCount = sqrt(current.rayCount);
  float x = mod(float(cascadeIndex), sqrtBaseRayCount);
  float y = float(cascadeIndex / int(sqrtBaseRayCount));
  return vec2(x, y) / sqrtBaseRayCount;
}

vec2 sampleUvMapped(vec2 sampleUv) {
  float minUvRemap = 0.5 / float(textureSize(tPrevCascade, 0).x);
  float maxUvRemap = 0.5 - minUvRemap;
  return minUvRemap + (maxUvRemap - minUvRemap) * sampleUv;
}

vec4 radiance(vec2 uv) {
  vec4 rad = vec4(0.);
  vec2 remapped = sampleUvMapped(uv);
  for (int i = 0; i < int(current.rayCount); i++) {
    vec2 offsetUv = cascadeUvOffset(i) + remapped;
    rad += texture2D(tPrevCascade, offsetUv);
  }
  return rad / current.rayCount;
}

  void main() {
    outColor = radiance(vUv);
  }
