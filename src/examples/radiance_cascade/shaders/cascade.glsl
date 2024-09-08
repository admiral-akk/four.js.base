#define M_PI 3.1415926538
#define TAU 6.283185307179586
#define EPS 0.00005

#if (LINE_SEGMENT_COUNT > 0)
struct LineSegment { 
  vec4 color;
  vec4 startEnd;
};
uniform LineSegment lineSegments[ LINE_SEGMENT_COUNT ];
#endif

uniform sampler2D tColor;
uniform sampler2D tSdf;
uniform sampler2D tPrevCascade;

// higher means fewer probes, more angles
uniform int cascadeDepth;

// the ray count at cascadeDepth = 0;
uniform int baseRayCount;
uniform int sqrtBaseRayCount;

uniform int rayCountAtDepth;
uniform int sqrtRayCountAtDepth;

uniform int rayCountAtNextDepth;
uniform int sqrtRayCountAtNextDepth;

uniform float tauOverRayCount;
uniform float tauOverRayCountAtNextDepth;

// To stop it from going indefinitely
// though minstep should handle this.
uniform int maxSteps;

uniform float minDeeperUv;
uniform float maxDeeperUv;

// Distance we travel before trying to use
// the higher cascade
uniform float maxDistance;

// to avoid zeno's paradox
uniform float minStep;

varying vec2 vUv;

out vec4 outColor;

bool outOfBounds(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}

vec2 cascadeUvOffset(int cascadeIndex) {
  float indexCount = float(sqrtRayCountAtNextDepth);
  float x = mod(float(cascadeIndex), indexCount);
  float y = float(cascadeIndex / sqrtRayCountAtNextDepth);
  return vec2(x, y) / indexCount;
}

void cascadeRange(int index, out ivec3 fullSample, out ivec2 halfSample) {
  int center = 4 * index;
  int bot = center - 1;
  int bot2 = center - 2;
  if (bot < 0) {
    bot += rayCountAtNextDepth;
    bot2 += rayCountAtNextDepth;
  }
  fullSample = ivec3(bot, center, center + 1);
  halfSample = ivec2(bot2, center + 2);
}

void sampleUvMapped(inout vec2 sampleUv) {
  sampleUv = minDeeperUv + (maxDeeperUv - minDeeperUv) * sampleUv;
}

void sampleCascadeIndex(vec2 mappedSampleUv, int cascadeIndex, float scale, inout vec4 radiance) {
  vec2 offset = cascadeUvOffset(cascadeIndex);
  radiance += scale * texture2D(tPrevCascade, mappedSampleUv + offset);
}

vec2 toDirection(int index, float tauOverCount) {
  float angle = tauOverCount * (float(index) + 0.5);
  return vec2(cos(angle), -sin(angle));
}

vec2 sampleCascadeStartUv(vec2 sampleUv, int cascadeIndex) {
  vec2 newUv = sampleUv + maxDistance * toDirection(cascadeIndex, tauOverRayCountAtNextDepth);
  sampleUvMapped(newUv);
  return newUv;
}

vec4 sampleCascade(vec2 sampleUv, int index) {
  ivec2 halfSample;
  ivec3 fullSample;
  cascadeRange(index, fullSample, halfSample);


  vec4 radiance = vec4(0.);
  sampleCascadeIndex(sampleCascadeStartUv(sampleUv, fullSample.x), fullSample.x, 0.25, radiance);
  sampleCascadeIndex(sampleCascadeStartUv(sampleUv, fullSample.y), fullSample.y, 0.25, radiance);
  sampleCascadeIndex(sampleCascadeStartUv(sampleUv, fullSample.z), fullSample.z, 0.25, radiance);
  sampleCascadeIndex(sampleCascadeStartUv(sampleUv, halfSample.x), halfSample.x, 0.125, radiance);
  sampleCascadeIndex(sampleCascadeStartUv(sampleUv, halfSample.y), halfSample.y, 0.125, radiance);
  return radiance;
}

float crossVec2(in vec2 a, in vec2 b) {
return a.x * b.y - b.x * a.y;
}

#if LINE_SEGMENT_COUNT > 0

float hitLineDistance(vec2 sampleUv, vec2 dir, LineSegment segment) {
  vec2 start = segment.startEnd.xy;
  vec2 end = segment.startEnd.zw;

  vec2 delta = end - start;

  float denom = crossVec2(delta, dir);
  if (denom == 0.) {
    return 100.;
  }
  float dist = crossVec2((sampleUv - start), delta) / crossVec2(delta, dir);

  if (dist < 0.) {
    return 100.;
  }

  vec2 lineHit = dist * dir + sampleUv;
  vec2 lineHitDelta = lineHit - start;

  float t = dot(lineHitDelta, delta) / dot(delta,delta);
  if (t > 1. || t < 0.) {
    return 100.;
  } 
  return dist;
}

#endif

vec4 fireRay2(vec2 sampleUv, int index) {
  vec2 originalSample = sampleUv;
  vec4 radiance = vec4(0.0);
  vec2 rayDirectionUv = toDirection(index, tauOverRayCount);
  float distTravelled = 0.;
  int step = maxSteps;

  int hitIndex = -1;
  float closestDist = 50.;

  #if (LINE_SEGMENT_COUNT > 0)
  for (int i = 0; i < LINE_SEGMENT_COUNT; i++) {
    float dist = hitLineDistance(sampleUv,  rayDirectionUv,  lineSegments[i]);
    if (dist < closestDist) {
      hitIndex = i;
      closestDist = dist;
    }
  }
  #endif
  if (closestDist < maxDistance) {
  #if (LINE_SEGMENT_COUNT > 0)
     radiance += lineSegments[hitIndex].color;
  #endif
    // hit something, do some stuff
  } else {
      radiance += sampleCascade(originalSample, index);
    // missed everything, see how far to edge?
  }
  return radiance;

}

vec4 fireRay(vec2 sampleUv, int index) {
  vec2 originalSample = sampleUv;
  vec4 radiance = vec4(0.0);
  vec2 rayDirectionUv = toDirection(index, tauOverRayCount);
  float distTravelled = 0.;
  int step = maxSteps;
  while (--step > 0) {
    if (outOfBounds(sampleUv)) {
      // Can't sample cascade here, because at the top level, the edge is blended
      // with the center
      //radiance += sampleCascade(originalSample, index);
      break;
    }
    float stepVal = texture2D(tSdf, sampleUv).x + minStep;
    // our SDF goes negative. This could cause bleed if it steps through
    // a wall and hit another wall, but it's fine for now.
    if (stepVal < 0.) {
      radiance += texture2D(tColor, sampleUv);
      break;
    }
    if (distTravelled >= maxDistance) {
      // sample from the higher cascade level
      radiance += sampleCascade(originalSample, index);
      break;
    }
    distTravelled += stepVal;
    sampleUv += stepVal * rayDirectionUv;
  }

  if (step == 0) {
      // sample from the higher cascade level
      radiance += sampleCascade(originalSample, index);
  }

  return radiance;
}

// returns the UV to start the probe from and the index which
// indicates the direction
void probeToEvaluate(vec2 uv, out vec2 probeUv, out int probeIndex) {
  float sqrtNumRays = float(sqrtRayCountAtDepth);

  probeUv = mod(uv * sqrtNumRays, vec2(1.));

  probeIndex = int(
      floor(sqrtNumRays * uv.x) + 
      sqrtNumRays * floor(sqrtNumRays * uv.y));
}

vec4 raymarch() {
    vec2 probeUv;
    int probeIndex;
    probeToEvaluate(vUv, probeUv, probeIndex);
    return fireRay(probeUv, probeIndex);
}
  
  void main() {
    outColor = raymarch();
  }