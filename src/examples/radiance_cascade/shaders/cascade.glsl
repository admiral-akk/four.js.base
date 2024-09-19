#define PI 3.141592654 
#define TAU (2.0*PI)

#if (LINE_SEGMENT_COUNT > 0)
struct LineSegment { 
  vec4 color;
  vec4 startEnd;
  int wallType;
};
uniform LineSegment lineSegments[ LINE_SEGMENT_COUNT ];
#endif

struct CascadeConfig { 
  float probeCount;
  float depth;
  int xSize;
  int ySize;
  float rayCount;
  float minDistance;
  float maxDistance;
};

struct DebugInfo {
  int finalDepth;
  int renderMode; 
};

uniform int startDepth;
uniform CascadeConfig current;
uniform CascadeConfig deeper;
uniform DebugInfo debug;
uniform sampler2D tPrevCascade;

varying vec2 vUv;

out vec4 outColor;

float crossVec2(in vec2 a, in vec2 b) {
  return a.x * b.y - b.x * a.y;
}

#if LINE_SEGMENT_COUNT > 0
float hitLineDistance(vec4 sampleStartEnd, vec4 segmentStartEnd) {
  vec2 p = sampleStartEnd.xy;
  vec2 r = sampleStartEnd.zw - sampleStartEnd.xy;
  vec2 q = segmentStartEnd.xy;
  vec2 s = segmentStartEnd.zw - segmentStartEnd.xy;

  float r_s = crossVec2(r,s);

  if (r_s == 0.) {
    return 1000.;
  }

  float t = crossVec2((q - p), s) / r_s;
  float u = crossVec2(p-q, r) / (-r_s);

  if (t < 0. || t > 1. || u < 0. || u > 1.) {
    return 100.;
  }

  return t;
}

void hitLines(vec2 start, vec2 end, int prevHit, out int hitIndex, out float hitDistance) {
  hitIndex = -1;
  hitDistance = 100.;
  vec4 sampleStartEnd = vec4(start, end);
  for (int i = 0; i < LINE_SEGMENT_COUNT; i++) {
    if (i != prevHit) {
      float dist = hitLineDistance(sampleStartEnd,  lineSegments[i].startEnd);
      if (dist < hitDistance) {
          hitIndex = i;
          hitDistance = dist;
      }

    }
  }
}
#endif

vec2 offsetForIndex(int deepIndex) {
  float width = float(textureSize(tPrevCascade, 0).x);
  float xIndex = mod(float(deepIndex), width / float(deeper.probeCount));
  float yIndex = floor(float(deepIndex) / ( width / float(deeper.probeCount)));
  return vec2(xIndex, yIndex) * deeper.probeCount / vec2(textureSize(tPrevCascade, 0));
}

float distToOutOfBounds(vec2 start, vec2 dir) {
  if (dir.x == 0.) {
    if (dir.y > 0.) {
      return  (1. - start.y) / dir.y;
    } else {
      return -start.y / dir.y;
    }
  }
  
  if (dir.y == 0.) {
    if (dir.x > 0.) {
      return  (1. - start.x) / dir.x;
    } else {
      return  -start.x / dir.x;
    }
  }
  
  float xDist = max((1. - start.x) / dir.x, -start.x / dir.x);
  float yDist = max((1. - start.y) / dir.y, -start.y / dir.y);
  return min(xDist, yDist);
}

vec2 probeIndexToUv(ivec3 probeIndex) {
  float delta = 1. / float(probeIndex.z);
  return vec2(probeIndex.xy) * delta + 0.5 * delta;
}

vec2 probeDirectionToDir(ivec2 probeDirection) {
  float tauOverIndexRayCount = TAU / float(probeDirection.y);
  float angle = tauOverIndexRayCount * (float(probeDirection.x) + 0.5);
  return vec2(cos(angle), -sin(angle));
}

vec2 mapToTextureUv(ivec3 sampleTarget) {
  vec2 delta = 1. / vec2(textureSize(tPrevCascade, 0));
  return vec2(sampleTarget.xy) * delta + 0.5 * delta;
}

vec4 sampleTexture(ivec3 sampleTarget, ivec2 probeDirection) {
  vec2 remappedUv = mapToTextureUv(sampleTarget);
  vec2 sampleUv1 = remappedUv + offsetForIndex(2 * probeDirection.x);
  vec2 sampleUv2 = remappedUv + offsetForIndex(2 * probeDirection.x + 1);

  return 0.5 * ( texture2D(tPrevCascade, sampleUv1) +  texture2D(tPrevCascade, sampleUv2)  );
}

vec4 sampleSky(vec2 dir) {
  return vec4(0.);
}

vec4 castRay(ivec2 directionIndex, vec2 start, vec2 end, ivec3 sampleTarget) {
    int hitIndex;
    float closestDist;
    vec4 lineColor = vec4(0.);
    #if (LINE_SEGMENT_COUNT > 0)
      hitLines(start, end, -1, hitIndex, closestDist);
      lineColor = lineSegments[hitIndex].color;
    #endif
    vec2 dir = normalize(end - start);
    float distToEdge = distToOutOfBounds(start, dir) ;
    if (closestDist < 1. && closestDist > 0. ) {
        return lineColor;
    } else if (distToEdge < length(end - start)) {
      return sampleSky(dir);
    } else {
      return sampleTexture(sampleTarget, directionIndex);
    } 
}

vec4 bilinearFix(ivec3 probeIndex, ivec2 directionIndex) {
  vec2 probeUv = probeIndexToUv(probeIndex);

  ivec3 indexTL = ivec3((probeIndex.x - 1) / 2, (probeIndex.y - 1) / 2, int(deeper.probeCount));
  vec2 probeTL = probeIndexToUv(indexTL);
  ivec3 indexTR = indexTL + ivec3(1, 0, 0);
  vec2 probeTR = probeIndexToUv(indexTR);
  ivec3 indexBL = indexTL + ivec3(0, 1, 0);
  vec2 probeBL = probeIndexToUv(indexBL);
  ivec3 indexBR = indexTL + ivec3(1, 1, 0);
  vec2 probeBR = probeIndexToUv(indexBR);
  vec2 rayDirectionUv = probeDirectionToDir(directionIndex);
  vec2 start = probeUv + current.minDistance * rayDirectionUv;
  vec2 end = probeUv + current.maxDistance * rayDirectionUv;

  vec4 radTL = castRay(directionIndex, start, end + (probeTL - probeUv), indexTL);
  vec4 radTR = castRay(directionIndex, start, end + (probeTR - probeUv), indexTR);
  vec4 radBL = castRay(directionIndex, start, end + (probeBL - probeUv), indexBL);
  vec4 radBR = castRay(directionIndex, start, end + (probeBR - probeUv), indexBR);

  vec2 weights = (probeUv - probeTL) / (probeBR - probeTL);

  if (probeIndex.x == 0) {
    weights.x = 1.;
  }

  if (probeIndex.y == 0) {
    weights.y = 1.;
  }

  if (probeIndex.x == probeIndex.z - 1) {
    weights.x = 0.;
  }

  if (probeIndex.y == probeIndex.z - 1) {
    weights.y = 0.;
  }

  vec4 top = mix(radTL, radTR, vec4(weights.x));
  vec4 bot = mix(radBL, radBR, vec4(weights.x));

  return mix(top, bot, vec4(weights.y));
}

void discreteProbeToEvaluate(vec2 uv, out ivec3 probeIndex, out ivec2 probeDirection) {
    vec2 pixel = uv * vec2(textureSize(tPrevCascade, 0));

    int xSize = int(float(textureSize(tPrevCascade, 0).x) / current.probeCount);
    int ySize = max(1, int(current.rayCount) / xSize);

    probeIndex = ivec3(
        int(mod(pixel.x, current.probeCount)), 
        int(mod(pixel.y, current.probeCount)), 
        int(current.probeCount));

    int xIndex = int(floor(pixel.x / current.probeCount));
    int yIndex = int(floor(pixel.y / current.probeCount));
    probeDirection = ivec2(xIndex + yIndex *xSize, int(current.rayCount));
    
    if (xIndex >= xSize || 
        yIndex >= ySize || 
        probeDirection.x >= probeDirection.y) {
        probeIndex = ivec3(-1);
    }
}

void main() {
    ivec3 probeIndex;
    ivec2 directionIndex;
    discreteProbeToEvaluate(vUv, probeIndex, directionIndex);

    if (probeIndex.x < 0) {
        outColor = vec4(1.,1.,0.,1.);
    }

    vec2 probeUv = probeIndexToUv(probeIndex);
    vec2 rayDirectionUv = probeDirectionToDir(directionIndex);
    if (probeIndex.x >= 0) {
        if (current.depth == float(startDepth)) {
          vec2 end = probeUv + current.maxDistance * rayDirectionUv;
          outColor = castRay(directionIndex, probeUv, end, ivec3(-1));
        } else {
            outColor = bilinearFix(probeIndex, directionIndex);
        }
    } else {
        outColor = vec4(1.,1.,0.,1.);
    }
    outColor.w = 1.;
}