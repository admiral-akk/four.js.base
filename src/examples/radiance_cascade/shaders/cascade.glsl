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
  return (probeUv * (deeper.probeCount - 1.) + 0.5) / vec2(textureSize(tPrevCascade, 0));
}

vec2 offsetForIndex(int deepIndex) {
  float width = float(textureSize(tPrevCascade, 0).x);
    float xIndex = mod(float(deepIndex), width / float(deeper.probeCount));
    float yIndex = floor(float(deepIndex) / ( width / float(deeper.probeCount)));
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
  return  vec2(sampleTarget.xy) * delta + 0.5 * delta;
}

vec4 sampleTexture(ivec3 sampleTarget, ivec2 probeDirection) {
  vec2 remappedUv = mapToTextureUv(sampleTarget);
  vec2 sampleUv1 = remappedUv + offsetForIndex(2 * probeDirection.x);
  vec2 sampleUv2 = remappedUv + offsetForIndex(2 * probeDirection.x + 1);

  return 0.5 * ( texture2D(tPrevCascade, sampleUv1) +  texture2D(tPrevCascade, sampleUv2)  );
}

vec4 castRay(ivec2 probeIndex2, vec2 start, vec2 end, ivec3 sampleTarget) {
  int bounces = 0;
  int prevHit = -1;
  while (bounces < 4) {
    int hitIndex;
    float closestDist;
    int type = -1;
    vec4 lineColor = vec4(0.);
    #if (LINE_SEGMENT_COUNT > 0)
      hitLines(start, end, prevHit, hitIndex, closestDist);
      lineColor = lineSegments[hitIndex].color ;
      type = lineSegments[hitIndex].wallType;
    #endif
    vec2 dir = normalize(end - start);
    float distToEdge = distToOutOfBounds(start, dir) ;
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
        return lineColor;
      }
    } else  {
      return sampleTexture(sampleTarget, probeIndex2);
    } 
    }
    return vec4(0.,0.,0.,0.);
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

// returns the UV to start the probe from and the index which
// indicates the direction
void probeToEvaluate(vec2 uv, out vec2 probeUv, out int probeIndex) {
    vec2 pixel = uv * vec2(textureSize(tPrevCascade, 0));
    
    int xIndex = int(floor(pixel.x / current.probeCount));
    int yIndex = int(floor(pixel.y / current.probeCount));

    int xSize = int(float(textureSize(tPrevCascade, 0).x) / current.probeCount);

    // indicates direction
    probeIndex = xIndex + yIndex * xSize;
    probeUv = uv / (current.probeCount / vec2(textureSize(tPrevCascade, 0))) - vec2(xIndex,yIndex);
    if (xIndex >= xSize || 
        yIndex >= xSize || 
        float(probeIndex) >= current.rayCount) {
        probeIndex = -1;
    }
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
    ivec3 probeIndex2;
    ivec2 directionIndex;
    discreteProbeToEvaluate(vUv, probeIndex2, directionIndex);

    if (probeIndex2.x < 0) {
        outColor = vec4(1.,1.,0.,1.);
    }

    vec2 probeUv = probeIndexToUv(probeIndex2);
    vec2 rayDirectionUv = probeDirectionToDir(directionIndex);
    if (probeIndex2.x >= 0) {
        if (debug.bilinearFix && !(current.depth == float(debug.startDepth))) {
          if (probeIndex2.x >= 0) {
            outColor = bilinearFix(probeIndex2, directionIndex);
          }
        } else {
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

          outColor = castRay(directionIndex, start, end, 2 * probeIndex2);
        }
    } else {
        outColor = vec4(1.,1.,0.,1.);
    }

    if (debug.renderMode == 13) {
      outColor = vec4((probeDirectionToDir(directionIndex) + 1.) / 2.,0.,1.);
    }
    if (debug.renderMode == 14) {
      outColor = vec4(probeIndexToUv(probeIndex2),0.,1.);
    }
    if (debug.renderMode == 15) {
      outColor = vec4(vUv, 0.,1.);
    }
    if (debug.renderMode == 1) {
      outColor = vec4(vUv, 0.,1.);
    }
}