#if (LINE_SEGMENT_COUNT > 0)
struct LineSegment { 
  vec4 color;
  vec4 startEnd;
};
uniform LineSegment lineSegments[ LINE_SEGMENT_COUNT ];
#endif

uniform sampler2D tPrevCascade;
uniform float tauOverRayCount;

uniform float halfUvPerPixel;

uniform int finalDepth;
uniform int currentDepth;
uniform int startDepth;

uniform float fogStepSize;

uniform int rayCount;
uniform int xSize;
uniform float invPixelCountPerProbe;

uniform int deepXSize;
uniform float deeperUvPerProbe;
uniform float uvPerProbe;

uniform float minDistance;
uniform float maxDistance;
uniform int renderMode;

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

float opacityAt(vec2 sampleUv) {
  return clamp(1. - length(sampleUv - vec2(0.4)), 0., 1.);
}

vec4 calculateFog(vec2 start, vec2 end, in vec4 hitColor) {
  return hitColor;
  // pretend there's a cloud in the middle?
  // need uniform step size
  float distTravelled = fogStepSize;
  vec2 dir = normalize(start - end);
  while (distTravelled < length(start - end)) {
    vec2 samplePoint = end + dir * distTravelled;
    hitColor *= opacityAt(samplePoint) * hitColor;
    distTravelled += fogStepSize;
  }
  return hitColor;
}

void hitLines(vec2 sampleUv, vec2 dir, out int hitIndex, out float hitDistance) {
  hitIndex = -1;
  hitDistance = 100.;
  vec4 sampleStartEnd = vec4(sampleUv + minDistance * dir, sampleUv + maxDistance * dir);
  for (int i = 0; i < LINE_SEGMENT_COUNT; i++) {
      float dist = hitLineDistance(sampleStartEnd,  lineSegments[i].startEnd);
      if (dist < hitDistance) {
          hitIndex = i;
          hitDistance = dist;
      }
  }
}
#endif

vec2 toDirection(int index, float tauOverIndexRayCount) {
  float angle = tauOverIndexRayCount * (float(index) + 0.5);
  return vec2(cos(angle), -sin(angle));
}

vec2 remapProbeUv(vec2 probeUv) {
  return probeUv * deeperUvPerProbe;
}

vec2 offsetForIndex(int deepIndex) {
    float xIndex = mod(float(deepIndex), float(deepXSize));
    float yIndex = floor(float(deepIndex) / float(deepXSize));
    return vec2(xIndex, yIndex) * deeperUvPerProbe;
}


vec4 sampleCascadeTexture(vec2 uv) {
  return texture2D(tPrevCascade, uv);
}

vec4 sampleCascade(int probeIndex, vec2 probeUv) {
    vec2 remappedUv = remapProbeUv(probeUv);
    if (renderMode == 7) {
      return vec4(remapProbeUv(probeUv), 0.,1.);
      return vec4(float(remappedUv.x >= deeperUvPerProbe - 4. * halfUvPerPixel ), 0., 0.,1.);
    }

    vec2 sampleUv1 = remappedUv + offsetForIndex(2 * probeIndex);
    vec2 sampleUv2 = remappedUv + offsetForIndex(2 * probeIndex + 1);
    if (renderMode == 8) {
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

vec4 castRay(int probeIndex, vec2 probeUv) {
    vec2 rayDirectionUv = toDirection(probeIndex, tauOverRayCount);

    int hitIndex;
    float closestDist;
    if (renderMode == 2) {
      return vec4(probeUv, 0.,1.);
    }
    if (renderMode == 3) {
      return vec4(float(probeIndex) / float(rayCount - 1), 0., 0.,1.);
    }

    #if (LINE_SEGMENT_COUNT > 0)
    hitLines(probeUv,  rayDirectionUv, hitIndex, closestDist);
    #endif

    vec4 lineColor = vec4(0.);
    #if (LINE_SEGMENT_COUNT > 0)
    if (renderMode == 4) {
      return vec4(float(closestDist < 10.) * (1. - closestDist), 0., 0.,1.);
    }
    if (renderMode == 5) {
      return vec4(float(hitIndex + 1) / float(LINE_SEGMENT_COUNT), 0., 0.,1.);
    }


    lineColor = lineSegments[hitIndex].color * float(closestDist < 10.) ;
    #endif
    float distToEdge = distToOutOfBounds(probeUv, rayDirectionUv) ;
    if (renderMode == 6) {
      return vec4(float(distToEdge >= maxDistance), 0., 0.,1.);
    }
    if (renderMode >= 7 && renderMode <= 9) {
      return sampleCascade(probeIndex, probeUv);
    }
    if (closestDist < 10.) {
      return calculateFog(probeUv, rayDirectionUv, lineColor);
    } else if (distToEdge >= maxDistance) {
      return sampleCascade(probeIndex, probeUv);
    }
    return vec4(0.,0.,0.,0.);
}

// returns the UV to start the probe from and the index which
// indicates the direction
void probeToEvaluate(vec2 uv, out vec2 probeUv, out int probeIndex) {
    vec2 pixel = uv * vec2(textureSize(tPrevCascade, 0));
    
    int xIndex = int(floor(pixel.x * invPixelCountPerProbe));
    int yIndex = int(floor(pixel.y * invPixelCountPerProbe));

    // indicates direction
    probeIndex = xIndex + yIndex * xSize;
    probeUv = uv / uvPerProbe - vec2(xIndex,yIndex);
    if (xIndex >= xSize || yIndex >= xSize || probeIndex >= rayCount) {
        probeIndex = -1;
    }
}


void main() {
    vec2 probeUv;
    int probeIndex;
    probeToEvaluate(vUv, probeUv, probeIndex);
    if (probeIndex >= 0) {
        outColor = castRay(probeIndex, probeUv);
    } else {
        outColor = vec4(0.,1.,0.,1.);
    }

    if (renderMode == 1) {
      outColor = vec4(vUv, 0.,1.);
    }
}