#define PI 3.141592654 
#define TAU (2.0*PI)

#if (LINE_SEGMENT_COUNT > 0)
struct LineSegment { 
  vec4 color;
  vec4 startEnd;
};
uniform LineSegment lineSegments[ LINE_SEGMENT_COUNT ];
#endif

struct CascadeConfig { 
  float probeCount;
  float depth;
  float rayCount;
  int xSize;
  float minDistance;
  float maxDistance;
};


struct DebugInfo {
  int startDepth;
  int finalDepth;
  int renderMode; 
  bool bilinearFix;
  bool offsetBoth;
};

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

void hitLines(vec2 start, vec2 end,  out int hitIndex, out float hitDistance) {
  hitIndex = -1;
  hitDistance = 100.;
  vec4 sampleStartEnd = vec4(start, end);
  for (int i = 0; i < LINE_SEGMENT_COUNT; i++) {
      float dist = hitLineDistance(sampleStartEnd,  lineSegments[i].startEnd);
      if (dist < hitDistance) {
          hitIndex = i;
          hitDistance = dist;
      }
  }
}
#endif

vec2 toDirection(int index) {
  float tauOverIndexRayCount = TAU / current.rayCount;
  float angle = tauOverIndexRayCount * (float(index) + 0.5);
  return vec2(cos(angle), -sin(angle));
}

vec2 remapProbeUv(vec2 probeUv) {
  return probeUv * deeper.probeCount / vec2(textureSize(tPrevCascade, 0));
}

vec2 offsetForIndex(int deepIndex) {
    float xIndex = mod(float(deepIndex), float(deeper.xSize));
    float yIndex = floor(float(deepIndex) / float(deeper.xSize));
    return vec2(xIndex, yIndex) * deeper.probeCount / vec2(textureSize(tPrevCascade, 0));
}


vec4 sampleCascadeTexture(vec2 uv) {
  return texture2D(tPrevCascade, uv);
}

vec4 sampleCascade(int probeIndex, vec2 probeUv) {
    vec2 remappedUv = remapProbeUv(probeUv);
    if (debug.renderMode == 7) {
      return vec4(remapProbeUv(probeUv), 0.,1.);
      return vec4(float(remappedUv.x >= deeper.probeCount / vec2(textureSize(tPrevCascade, 0)).x - 4. * vec2(textureSize(tPrevCascade, 0)).x / 2. ), 0., 0.,1.);
    }

    vec2 sampleUv1 = remappedUv + offsetForIndex(2 * probeIndex);
    vec2 sampleUv2 = remappedUv + offsetForIndex(2 * probeIndex + 1);
    if (debug.renderMode == 8) {
      return vec4(sampleUv1, 0.,1.);
    }

    return 0.5 * (
            sampleCascadeTexture(sampleUv1) 
            + sampleCascadeTexture(sampleUv2)
            );
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

vec4 castRay(int probeIndex, vec2 probeUv, vec2 start, vec2 end) {
    vec2 rayDirectionUv = toDirection(probeIndex);

    int hitIndex;
    float closestDist;
    if (debug.renderMode == 3) {
      return vec4(float(probeIndex) / (current.rayCount - 1.), 0., 0.,1.);
    }

    #if (LINE_SEGMENT_COUNT > 0)
    hitLines(start, end,   hitIndex, closestDist);
    #endif

    vec4 lineColor = vec4(0.);
    #if (LINE_SEGMENT_COUNT > 0)
    if (debug.renderMode == 4) {
      return vec4(float(closestDist < 10.) * (1. - closestDist), 0., 0.,1.);
    }
    if (debug.renderMode == 5) {
      return vec4(float(hitIndex + 1) / float(LINE_SEGMENT_COUNT), 0., 0.,1.);
    }


    lineColor = lineSegments[hitIndex].color * float(closestDist < 10.) ;
    #endif
    float distToEdge = distToOutOfBounds(probeUv, rayDirectionUv) ;
    if (debug.renderMode == 6) {
      return vec4(float(distToEdge >= current.maxDistance), 0., 0.,1.);
    }
    if (debug.renderMode >= 7 && debug.renderMode <= 9) {
      return sampleCascade(probeIndex, probeUv);
    }
    if (closestDist < 10.) {
      return lineColor;
    } else if (distToEdge >= current.maxDistance) {
      return sampleCascade(probeIndex, probeUv);
    }
    return vec4(0.,0.,0.,0.);
}

vec4 bilinearFix(int probeIndex, vec2 probeUv) {
  vec2 probeTL = (floor(probeUv * deeper.probeCount) ) / deeper.probeCount;
  vec2 delta = 1. / vec2(deeper.probeCount);
  vec2 probeTR = probeTL + vec2(delta.x, 0.);
  vec2 probeBL = probeTL + vec2(0., delta.y);
  vec2 probeBR = probeTL + delta;

  vec2 rayDirectionUv = toDirection(probeIndex);
  vec2 start = probeUv + current.minDistance * rayDirectionUv;
  vec2 end = probeUv + current.maxDistance * rayDirectionUv;

  vec2 startTL = debug.offsetBoth ? start + (probeTL - probeUv) : start;
  vec2 startTR = debug.offsetBoth ? start + (probeTR - probeUv) : start;
  vec2 startBL = debug.offsetBoth ? start + (probeBL - probeUv) : start;
  vec2 startBR = debug.offsetBoth ? start + (probeBR - probeUv) : start;

  vec4 radTL = castRay(probeIndex, probeTL, startTL, end + (probeTL - probeUv));
  vec4 radTR = castRay(probeIndex, probeTR, startTR, end + (probeTR - probeUv));
  vec4 radBL = castRay(probeIndex, probeBL, startBL, end + (probeBL - probeUv));
  vec4 radBR = castRay(probeIndex, probeBR, startBR, end + (probeBR - probeUv));

  vec2 weights = (probeUv - probeTL) / delta;

  vec4 top = mix(radTL, radTR, vec4(weights.x));
  vec4 bot = mix(radBL, radBR, vec4(weights.x));

  return mix(top, bot, vec4(weights.y));
}

// returns the UV to start the probe from and the index which
// indicates the direction
void probeToEvaluate(vec2 uv, out vec2 probeUv, out int probeIndex) {
    vec2 pixel = uv * vec2(textureSize(tPrevCascade, 0));
    
    int xIndex = int(floor(pixel.x / current.probeCount));
    int yIndex = int(floor(pixel.y / current.probeCount));

    // indicates direction
    probeIndex = xIndex + yIndex * current.xSize;
    probeUv = uv / (current.probeCount / vec2(textureSize(tPrevCascade, 0))) - vec2(xIndex,yIndex);
    if (xIndex >= current.xSize || 
        yIndex >= current.xSize || 
        float(probeIndex) >= current.rayCount) {
        probeIndex = -1;
    }
}


void main() {
    vec2 probeUv;
    int probeIndex;
    probeToEvaluate(vUv, probeUv, probeIndex);
    if (probeIndex >= 0) {
        if (debug.bilinearFix && !(current.depth == float(debug.startDepth))) {
          outColor =  bilinearFix(probeIndex, probeUv);

        } else {
          vec2 rayDirectionUv = toDirection(probeIndex);
          vec2 start = probeUv + current.minDistance * rayDirectionUv;
          vec2 end = probeUv + current.maxDistance * rayDirectionUv;

          outColor =  castRay(probeIndex, probeUv, start, end);
        }
    } else {
        outColor = vec4(0.,1.,0.,1.);
    }

    if (debug.renderMode == 1) {
      outColor = vec4(vUv, 0.,1.);
    }
}