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


// gets the uv needed to sample the texture for this index
vec2 indicesToSampleUv(ivec4 probeIndex) {
  ivec2 texSize = textureSize(tPrevCascade, 0);
  vec2 pixelSizeInUv = 1. / vec2(texSize); 

  vec2 probeOffset = (vec2(probeIndex.xy) + 0.5) * pixelSizeInUv;
  vec2 depthOffset = vec2(0., 1. / float(1 << (probeIndex.w + 1)));
  vec2 directionOffset = vec2(float(probeIndex.z) / float(4 << probeIndex.w), 0.);

  return probeOffset + depthOffset + directionOffset;
}

vec4 sampleTexture(ivec4 sampleTarget, ivec4 sampleTarget2) {
  return 0.5 * ( 
    texture2D(tPrevCascade, indicesToSampleUv(sampleTarget)) 
    + texture2D(tPrevCascade, indicesToSampleUv(sampleTarget2))  
  );
}


vec4 sampleSky(vec2 dir) {
  return  vec4(0., 0., 0.0,1.);
}

vec4 castRay(vec2 start, vec2 end, ivec4 sampleTarget, ivec4 sampleTarget2) {
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
      return sampleTexture(sampleTarget, sampleTarget2);
    } 
}


// gets the uv of the probe for this index
vec2 indicesToProbeUv(ivec4 probeIndex) {
  float probeCount = float((int(textureSize(tPrevCascade, 0).x) / 4) >> probeIndex.w);
  return (vec2(probeIndex.xy) + 0.5) / probeCount; 
}


vec2 probeDirectionToDir2(ivec4 probeIndex) {
  float tauOverIndexRayCount = TAU / float(4 << probeIndex.w);
  float angle = tauOverIndexRayCount * (float(probeIndex.z) + 0.5);
  return vec2(cos(angle), -sin(angle));
}

vec2 lineSegmentUv(ivec4 probeIndex, float distance) {
  vec2 probeUv = indicesToProbeUv(probeIndex);
  vec2 rayDirectionUv = probeDirectionToDir2(probeIndex);
  return probeUv + distance * rayDirectionUv;
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
      out ivec2 probeDirection) {
    vec2 pixel = uv * vec2(textureSize(tPrevCascade, 0));

    int xSize = int(float(textureSize(tPrevCascade, 0).x) / current.probeCount);
    int ySize = max(1, int(current.rayCount) / xSize);

    probeIndex = ivec3(
        int(mod(pixel.x, current.probeCount)), 
        int(mod(pixel.y, current.probeCount)), 
        int(current.probeCount));

    int xIndex = int(floor(pixel.x / current.probeCount));
    int yIndex = int(floor(pixel.y / current.probeCount));
    probeDirection = ivec2(xIndex + yIndex * xSize, int(current.rayCount));
    
    if (xIndex >= xSize || 
        yIndex >= ySize || 
        probeDirection.x >= probeDirection.y) {
        probeIndex = ivec3(-1);
    }
}



vec4 continousbilinearFix(ivec4 probeIndex) { 
  vec2 probeUv = indicesToProbeUv(probeIndex);

  ivec4 indexTL = ivec4(
    int(floor(float(probeIndex.x - 1) / 2.)),
    int(floor(float(probeIndex.y - 1) / 2.)),
    2 * probeIndex.z,
    probeIndex.w + 1
  );

  ivec4 indexTR = indexTL + ivec4(1, 0, 0, 0);
  ivec4 indexBL = indexTL + ivec4(0, 1, 0, 0);
  ivec4 indexBR = indexTL + ivec4(1, 1, 0, 0);


  vec2 probeTLEnd1 = lineSegmentUv(indexTL, deeper.minDistance);
  vec2 probeTLEnd2 = lineSegmentUv(indexTL + ivec4(0,0,1,0), deeper.minDistance);
  
  vec2 probeTREnd1 = lineSegmentUv(indexTR, deeper.minDistance);
  vec2 probeTREnd2 = lineSegmentUv(indexTR + ivec4(0,0,1,0), deeper.minDistance);
  
  vec2 probeBLEnd1 = lineSegmentUv(indexBL, deeper.minDistance);
  vec2 probeBLEnd2 = lineSegmentUv(indexBL + ivec4(0,0,1,0), deeper.minDistance);
  
  vec2 probeBREnd1 = lineSegmentUv(indexBR, deeper.minDistance);
  vec2 probeBREnd2 = lineSegmentUv(indexBR + ivec4(0,0,1,0), deeper.minDistance);

  vec2 start = lineSegmentUv(probeIndex,  current.minDistance);


  vec4 radTL1 = castRay(start, probeTLEnd1, indexTL, indexTL);
  vec4 radTL2 = castRay(start, probeTLEnd2, indexTL + ivec4(0,0,1,0), indexTL + ivec4(0,0,1,0));
  vec4 radTL = 0.5 * (radTL1 + radTL2);

  vec4 radTR1 = castRay(start, probeTREnd1, indexTR, indexTR);
  vec4 radTR2 = castRay(start, probeTREnd2, indexTR + ivec4(0,0,1,0), indexTR + ivec4(0,0,1,0));
  vec4 radTR = 0.5 * (radTR1 + radTR2);

  vec4 radBL1 = castRay(start, probeBLEnd1, indexBL, indexBL);
  vec4 radBL2 = castRay(start, probeBLEnd2, indexBL + ivec4(0,0,1,0), indexBL + ivec4(0,0,1,0));
  vec4 radBL = 0.5 * (radBL1 + radBL2);

  vec4 radBR1 = castRay(start, probeBREnd1, indexBR, indexBR);
  vec4 radBR2 = castRay(start, probeBREnd2, indexBR + ivec4(0,0,1,0), indexBR + ivec4(0,0,1,0));
  vec4 radBR = 0.5 * (radBR1 + radBR2);

  ivec2 texSize = textureSize(tPrevCascade, 0);

  int probeCount = texSize.x >> (probeIndex.w + 2);

  vec2 probeTL = indicesToProbeUv(indexTL);
  vec2 probeBR = indicesToProbeUv(indexBR);

  vec2 weights = (probeUv - probeTL) / (probeBR - probeTL);
  if (probeIndex.x == 0) {
    weights.x = 1.;
  }
  if (probeIndex.y == 0) {
    weights.y = 1.;
  }
  if (probeIndex.x == probeCount - 1) {
    weights.x = 0.;
  }
  if (probeIndex.y == probeCount - 1) {
    weights.y = 0.;
  }

  vec4 top = mix(radTL, radTR, vec4(weights.x));
  vec4 bot = mix(radBL, radBR, vec4(weights.x));

  return mix(top, bot, vec4(weights.y));

}


vec4 bilinearFix(ivec4 probeIndex) {
  vec2 probeUv = indicesToProbeUv(probeIndex);

  ivec4 indexTL = ivec4(
    int(floor(float(probeIndex.x - 1) / 2.)),
    int(floor(float(probeIndex.y - 1) / 2.)),
    2 * probeIndex.z,
    probeIndex.w + 1
  );

  vec2 probeTL = indicesToProbeUv(indexTL);
  ivec4 indexTR = indexTL + ivec4(1, 0, 0, 0);
  vec2 probeTR = indicesToProbeUv(indexTR); 
  ivec4 indexBL = indexTL + ivec4(0, 1, 0, 0);
  vec2 probeBL = indicesToProbeUv(indexBL);
  ivec4 indexBR = indexTL + ivec4(1, 1, 0, 0);
  vec2 probeBR = indicesToProbeUv(indexBR);
  vec2 rayDirectionUv = probeDirectionToDir2(probeIndex);
  vec2 start = probeUv + current.minDistance * rayDirectionUv;
  vec2 end = probeUv + current.maxDistance * rayDirectionUv;

  vec4 radTL = castRay(start, end + (probeTL - probeUv), indexTL, indexTL + ivec4(0,0,1,0));
  vec4 radTR = castRay(start, end + (probeTR - probeUv), indexTR, indexTR + ivec4(0,0,1,0));
  vec4 radBL = castRay(start, end + (probeBL - probeUv), indexBL, indexBL + ivec4(0,0,1,0));
  vec4 radBR = castRay(start, end + (probeBR - probeUv), indexBR, indexBR + ivec4(0,0,1,0));

  vec2 weights = (probeUv - probeTL) / (probeBR - probeTL);

  if (probeIndex.x == 0) {
    weights.x = 1.;
  }
  if (probeIndex.y == 0) {
    weights.y = 1.;
  }

  ivec2 texSize = textureSize(tPrevCascade, 0);

  int probeCount = texSize.x >> (probeIndex.w + 2);

  if (probeIndex.x == probeCount - 1) {
    weights.x = 0.;
  }
  if (probeIndex.y == probeCount - 1) {
    weights.y = 0.;
  }
  vec4 top = mix(radTL, radTR, vec4(weights.x));
  vec4 bot = mix(radBL, radBR, vec4(weights.x));

  return mix(top, bot, vec4(weights.y));
}

void main() {
    ivec4 newIndex = sampleUvToIndices(vUv);
    if (newIndex.w != int(current.depth)) {
      outColor = texture2D(tPrevCascade, vUv);
    } else if (current.depth == float(startDepth)) {
      vec2 start = lineSegmentUv(newIndex, 0.);
      vec2 end = lineSegmentUv(newIndex, current.maxDistance);
      outColor = castRay(start, end, ivec4(-1), ivec4(-1));
    } else if (debug.continousBilinearFix) {
      outColor = continousbilinearFix(newIndex);
    } else {
      outColor = bilinearFix(newIndex);
    }
    
    outColor.w = 1.;
}
