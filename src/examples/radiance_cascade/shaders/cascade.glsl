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

uniform float lineThickness;

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

    vec2 sampleUv1 = remappedUv + offsetForIndex(2 * probeIndex);
    vec2 sampleUv2 = remappedUv + offsetForIndex(2 * probeIndex + 1);

    return 0.5 * (
            sampleCascadeTexture(sampleUv1) 
            + sampleCascadeTexture(sampleUv2)
            );
}

vec4 genericSampleCascade(vec2 dir, vec2 end) {
  if (current.depth == float(debug.startDepth)) {
    return vec4(0.);
  }
  vec2 probeUv = end - current.maxDistance * dir;
  vec2 remappedUv = remapProbeUv(probeUv);
  float angleStep =  TAU / deeper.rayCount ;
  float angle = mod(atan(dir.y, -dir.x) + PI , TAU);
  float offsetAngle = angle  - 0.5 * angleStep;
  int prevProbeIndex = int(floor(offsetAngle / angleStep));
  int nextProbeIndex = prevProbeIndex + 1;
  vec4 weights = vec4(angle - angleStep * (float(prevProbeIndex) + 0.5)) / angleStep ;
  if (prevProbeIndex < 0) {
    prevProbeIndex = int(deeper.rayCount)  - 1;
  }
  vec2 sampleUv1 = remappedUv + offsetForIndex(prevProbeIndex);
  vec2 sampleUv2 = remappedUv + offsetForIndex(nextProbeIndex);
  return mix(
           sampleCascadeTexture(sampleUv1) ,
           sampleCascadeTexture(sampleUv2), 
           weights
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
  int bounces = 0;
  int prevHit = -1;
  float minDist = current.minDistance;
  float maxDist = current.maxDistance;
  vec2 initialDir = normalize(end - start);
  while (bounces < 4) {
    int hitIndex;
    float closestDist;
    int type = -1;
    vec4 lineColor = vec4(0.);
    #if (LINE_SEGMENT_COUNT > 0)
      hitLines(start, end, prevHit, hitIndex, closestDist);
      lineColor = lineSegments[hitIndex].color * float(closestDist < 10.) ;
      type = lineSegments[hitIndex].wallType;
    #endif
    vec2 dir = normalize(end - start);
    float distToEdge = distToOutOfBounds(probeUv, dir) ;
    if (closestDist < 1. && closestDist > 0. ) {
      if (type == 1) {
        // find the point of intersection, reflect the ray about the line,
        // continue
    #if (LINE_SEGMENT_COUNT > 0)
        vec2 a = lineSegments[hitIndex].startEnd.xy;
        vec2 b = lineSegments[hitIndex].startEnd.zw;
        start += (end - start) * closestDist;

        vec2 ba = b - a;
        vec2 ca = end - a;
        vec2 d = dot(normalize(ba),ca) * normalize(ba)  + a; 
        end = 2. * d - end;
        prevHit = hitIndex;
        dir = normalize(end - start);
    if (debug.renderMode == 5) {
          return vec4((dir + 1.)/ 2.,0.,1.);
    }
    if (debug.renderMode == 10) {
      return vec4(end, 0., 1.);
    }
    if (debug.renderMode == 11) {
      return vec4(start, 0., 1.);
    }
    if (debug.renderMode == 9) {
      return vec4(closestDist, 0., 0., 1.);
    }

    #endif
        bounces++;
      } else {
        if (bounces > 0) {
    if (debug.renderMode > 5) {
      return vec4(0.);
    }
    }
    if (debug.renderMode >= 5) {
      return vec4(0.);
    }
        return lineColor;
      }
    } else if (distToEdge >= current.maxDistance) {
      if (debug.renderMode != 0) {
        
        return vec4(0.,0.,0.,0.);
      }
      return genericSampleCascade(dir, end);
      return sampleCascade(probeIndex, probeUv);
    } else {
      return vec4(0.,0.,0.,0.);
    }
    }
    return vec4(0.,0.,0.,0.);
}

vec4 bilinearFix(int probeIndex, vec2 probeUv) {
  vec2 probeTL = floor(probeUv * deeper.probeCount) / deeper.probeCount;
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
          outColor = bilinearFix(probeIndex, probeUv);
        } else {
          vec2 rayDirectionUv = toDirection(probeIndex);
          vec2 start = probeUv + current.minDistance * rayDirectionUv;
          vec2 end = probeUv + current.maxDistance * rayDirectionUv;
          if (debug.renderMode == 1) {
            outColor = vec4((normalize(end-start) + 1.) / 2., 0.,1.);
          }
          if (debug.renderMode == 8) {
            vec2 dir = normalize(end-start);
            float angle = mod(atan(dir.y, -dir.x) + PI , TAU);
            outColor = vec4(angle / TAU, 0., 0.,1.);
            return;
          }

          outColor =  castRay(probeIndex, probeUv, start, end);
        }
    } else {
        outColor = vec4(0.,1.,0.,1.);
    }

    if (debug.renderMode == 1) {
      outColor = vec4(vUv, 0.,1.);
    }
}