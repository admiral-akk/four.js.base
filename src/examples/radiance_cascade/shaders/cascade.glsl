#define PI 3.141592654 
#define TAU (2.0*PI)
#define BAD_PROBE_INDEX_COLOR vec4(1.,1.,0.,1.);
#define DEBUG_COLOR vec4(0.,1.,1.,1.);
#define RESERVED_COLOR vec4(0.5,0.5,0.,1.);

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
  bool continousBilinearFix;
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

bool indexOutOfBounds(ivec3 index) {
  return 
    index.x < 0 ||
    index.y < 0 ||
    index.x > index.z - 1 ||
    index.y > index.z - 1;
}

ivec3 clampIndex(ivec3 index) {
  if (index.x < 0) {
    index.x = 0;
  }
  if (index.y < 0) {
    index.y = 0;
  }
  if (index.x > index.z - 1 ) {
    index.x = index.z - 1 ;
  }
  if (index.y > index.z - 1 ) {
    index.y = index.z - 1 ;
  }
  return index;
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

vec4 sampleTexture(ivec3 sampleTarget, ivec2 sampleDirections) {
  sampleTarget = clampIndex(sampleTarget);
  if (indexOutOfBounds(sampleTarget)) {
    return vec4(0.);
  }
  vec2 remappedUv = mapToTextureUv(sampleTarget);
  vec2 sampleUv1 = remappedUv + offsetForIndex(sampleDirections.x);
  vec2 sampleUv2 = remappedUv + offsetForIndex(sampleDirections.y);

  return 0.5 * ( texture2D(tPrevCascade, sampleUv1) +  texture2D(tPrevCascade, sampleUv2)  );
}

vec4 sampleSky(vec2 dir) {
  return  vec4(0., 0., 0.0,1.);
}

bool outOfBounds(vec2 uv) {
  return uv.x > 1. || uv.x < 0. || uv.y > 1. || uv.y < 0.;
}

vec4 castRay(vec2 start, vec2 end, ivec3 sampleTarget, ivec2 sampleDirections) {
    vec2 dir = normalize(end - start);
    int hitIndex;
    float closestDist;
    vec4 lineColor = vec4(0.);
    #if (LINE_SEGMENT_COUNT > 0)
      hitLines(start, end, -1, hitIndex, closestDist);
      lineColor = lineSegments[hitIndex].color;
    #endif
    float distToEdge = distToOutOfBounds(start, dir) ;
    if (closestDist < 1. && closestDist > 0. ) {
        return lineColor;
    } else if (distToEdge < length(end - start)) {
      return sampleSky(dir);
    } else {
      return sampleTexture(sampleTarget, sampleDirections);
    } 
}

vec2 lineSegmentUv(ivec3 probeIndex, ivec2 directionIndex, float distance) {
  vec2 probeUv = probeIndexToUv(probeIndex);
  vec2 rayDirectionUv = probeDirectionToDir(directionIndex);
  return probeUv + distance * rayDirectionUv;
}

vec4 bilinearFix(ivec3 probeIndex, ivec2 directionIndex) {
  vec2 probeUv = probeIndexToUv(probeIndex);

  ivec3 indexTL = ivec3(int(floor(float(probeIndex.x - 1) / 2.)), int(floor(float(probeIndex.y - 1) / 2.)), int(deeper.probeCount));
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

  ivec2 sampleDirections = ivec2(2 * directionIndex.x , 2 * directionIndex.x + 1);

  vec4 radTL = castRay(start, end + (probeTL - probeUv), indexTL, sampleDirections);
  vec4 radTR = castRay(start, end + (probeTR - probeUv), indexTR, sampleDirections);
  vec4 radBL = castRay(start, end + (probeBL - probeUv), indexBL, sampleDirections);
  vec4 radBR = castRay(start, end + (probeBR - probeUv), indexBR, sampleDirections);

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

// gets the uv needed to sample the texture for this index
vec2 indicesToSampleUv(ivec4 probeIndex) {
  ivec2 texSize = textureSize(tPrevCascade, 0);
  vec2 pixelSizeInUv = 1. / vec2(texSize); 

  vec2 probeOffset = (vec2(probeIndex.xy) + 0.5) * pixelSizeInUv;
  vec2 depthOffset = vec2(0., 1. / float(1 << (probeIndex.w + 1)));
  vec2 directionOffset = vec2(float(probeIndex.z) / float(4 << probeIndex.w), 0.);

  return probeOffset + depthOffset + directionOffset;
}

// gets the uv of the probe for this index
vec2 indicesToProbeUv(ivec4 probeIndex) {
  float probeCount = float((int(textureSize(tPrevCascade, 0).x) / 4) >> probeIndex.w);
  return (vec2(probeIndex.xy) + 0.5) / probeCount; 
}

// gets the index that corresponds to this texture uv
ivec4 sampleUvToIndices(vec2 uv) {
  int depth = -int(ceil(log2(uv.y)));

  ivec2 texSize = textureSize(tPrevCascade, 0);

  vec2 pixel = uv * vec2(texSize);

  float probeCount = float(texSize.x >> (depth + 2));

  int x = int(mod(pixel.x, probeCount));
  int y = int(mod(pixel.y, probeCount)); 

  int directionIndex = int(floor(pixel.x / probeCount));

  return ivec4(x,y,directionIndex,depth);
}

void discreteProbeToEvaluate(
      vec2 uv, 
      out ivec3 probeIndex, 
      out ivec2 probeDirection,
      out ivec4 newProbeIndex) {
    vec2 pixel = uv * vec2(textureSize(tPrevCascade, 0));

    int xSize = int(float(textureSize(tPrevCascade, 0).x) / current.probeCount);
    int ySize = max(1, int(current.rayCount) / xSize);

    probeIndex = ivec3(
        int(mod(pixel.x, current.probeCount)), 
        int(mod(pixel.y, current.probeCount)), 
        int(current.probeCount));
    newProbeIndex = ivec4(
        int(mod(pixel.x, current.probeCount)), 
        int(mod(pixel.y, current.probeCount)), 
        int(current.probeCount),
        current.depth);

    int xIndex = int(floor(pixel.x / current.probeCount));
    int yIndex = int(floor(pixel.y / current.probeCount));
    probeDirection = ivec2(xIndex + yIndex * xSize, int(current.rayCount));
    
    if (xIndex >= xSize || 
        yIndex >= ySize || 
        probeDirection.x >= probeDirection.y) {
        probeIndex = ivec3(-1);
    }
}


vec4 continousBilinearFix(ivec3 probeIndex, ivec2 directionIndex) { 
  vec2 probeUv = probeIndexToUv(probeIndex);

  ivec2 deeperDirIndex1 = ivec2(2 * directionIndex.x, 2*directionIndex.y);
  ivec2 deeperDirIndex2 = deeperDirIndex1 + ivec2(1,0);

   ivec3 indexTL = ivec3(int(floor(float(probeIndex.x - 1) / 2.)), int(floor(float(probeIndex.y - 1) / 2.)), int(deeper.probeCount));
  ivec3 indexTR = indexTL + ivec3(1, 0, 0);
  ivec3 indexBL = indexTL + ivec3(0, 1, 0);
  ivec3 indexBR = indexTL + ivec3(1, 1, 0);
  vec2 probeTL = probeIndexToUv(indexTL);
  vec2 probeBR = probeIndexToUv(indexBR);

  vec2 probeTLEnd1 = lineSegmentUv(indexTL, deeperDirIndex1, deeper.minDistance);
  vec2 probeTLEnd2 = lineSegmentUv(indexTL, deeperDirIndex2, deeper.minDistance);
  
  vec2 probeTREnd1 = lineSegmentUv(indexTR, deeperDirIndex1, deeper.minDistance);
  vec2 probeTREnd2 = lineSegmentUv(indexTR, deeperDirIndex2, deeper.minDistance);
  
  vec2 probeBLEnd1 = lineSegmentUv(indexBL, deeperDirIndex1, deeper.minDistance);
  vec2 probeBLEnd2 = lineSegmentUv(indexBL, deeperDirIndex2, deeper.minDistance);
  
  vec2 probeBREnd1 = lineSegmentUv(indexBR, deeperDirIndex1, deeper.minDistance);
  vec2 probeBREnd2 = lineSegmentUv(indexBR, deeperDirIndex2, deeper.minDistance);

  vec2 start = lineSegmentUv(probeIndex, directionIndex, current.minDistance);

  ivec2 sampleDirections1 = ivec2(2 * directionIndex.x);
  ivec2 sampleDirections2 = ivec2(2 * directionIndex.x + 1);

  vec4 radTL1 = castRay(start, probeTLEnd1, indexTL, sampleDirections1);
  vec4 radTL2 = castRay(start, probeTLEnd2, indexTL, sampleDirections2);
  vec4 radTL = 0.5 * (radTL1 + radTL2);

  vec4 radTR1 = castRay(start, probeTREnd1, indexTR, sampleDirections1);
  vec4 radTR2 = castRay(start, probeTREnd2, indexTR, sampleDirections2);
  vec4 radTR = 0.5 * (radTR1 + radTR2);

  vec4 radBL1 = castRay(start, probeBLEnd1, indexBL, sampleDirections1);
  vec4 radBL2 = castRay(start, probeBLEnd2, indexBL, sampleDirections2);
  vec4 radBL = 0.5 * (radBL1 + radBL2);

  vec4 radBR1 = castRay(start, probeBREnd1, indexBR, sampleDirections1);
  vec4 radBR2 = castRay(start, probeBREnd2, indexBR, sampleDirections2);
  vec4 radBR = 0.5 * (radBR1 + radBR2);

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

void main() {
    ivec3 probeIndex;
    ivec2 directionIndex;
    ivec4 newProbeIndex;
    discreteProbeToEvaluate(vUv, probeIndex, directionIndex, newProbeIndex);

    if (probeIndex.x >= 0) {
        if (current.depth == float(startDepth)) {
          vec2 start = lineSegmentUv(probeIndex, directionIndex, 0.);
          vec2 end = lineSegmentUv(probeIndex, directionIndex, current.maxDistance);
          outColor = castRay(start, end, ivec3(-1), ivec2(-1));
        } else {
          if (debug.continousBilinearFix) {
            outColor = continousBilinearFix(probeIndex, directionIndex);
          } else {
            outColor = bilinearFix(probeIndex, directionIndex);
          }
        }
    } else {
      outColor = texture2D(tPrevCascade, vUv) ;
      outColor = BAD_PROBE_INDEX_COLOR;
    }
    
    outColor.w = 1.;

    ivec4 newIndex = sampleUvToIndices(vUv);
    vec2 reversedIndex = indicesToSampleUv(newIndex);

    outColor.rgb = vec3(reversedIndex,0.);
}
