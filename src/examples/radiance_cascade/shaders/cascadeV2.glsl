#if (LINE_SEGMENT_COUNT > 0)
struct LineSegment { 
  vec4 color;
  vec4 startEnd;
};
uniform LineSegment lineSegments[ LINE_SEGMENT_COUNT ];
#endif

uniform sampler2D tPrevCascade;

uniform float tauOverRayCount;
uniform float tauOverDeeperRayCount;

uniform float minDeeperUv;
uniform float maxDeeperUv;

uniform float halfUvPerPixel;

uniform int finalDepth;
uniform int currentDepth;
uniform int startDepth;

uniform int rayCount;
uniform int xSize;
uniform float invPixelCountPerProbe;

uniform int deepXSize;
uniform float deeperUvPerProbe;

uniform float maxDistance;

varying vec2 vUv;

out vec4 outColor;


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

vec2 toDirection(int index, float tauOverIndexRayCount) {
  float angle = tauOverIndexRayCount * (float(index) + 0.5);
  return vec2(cos(angle), -sin(angle));
}

// returns the UV to start the probe from and the index which
// indicates the direction
void probeToEvaluate(vec2 uv, out vec2 probeUv, out int probeIndex) {
    vec2 pixel = uv * vec2(textureSize(tPrevCascade, 0));
    
    int xIndex = int(floor(pixel.x * invPixelCountPerProbe));
    int yIndex = int(floor(pixel.y * invPixelCountPerProbe));

    probeIndex = xIndex + yIndex * xSize;
    probeUv = clamp(uv * float(xSize) - vec2(xIndex,yIndex), 0., 1.);
    if (xIndex >= xSize || yIndex >= xSize || probeIndex >= rayCount) {
        probeIndex = -1;
    }
}

vec2 offsetForIndex(int deepIndex) {
    float xIndex = mod(float(deepIndex), float(deepXSize));
    float yIndex = floor(float(deepIndex) / float(deepXSize));
    return vec2(xIndex, yIndex) * deeperUvPerProbe;
}

vec2 remapProbeUv(vec2 probeUv) {
  vec2 rescaledProbeUv = halfUvPerPixel + (1. - halfUvPerPixel) * probeUv;
  return deeperUvPerProbe * rescaledProbeUv;
}

vec4 sampleCascadeTexture(vec2 uv) {
  return texture2D(tPrevCascade, uv);
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

vec4 sampleCascade(int probeIndex, vec2 probeUv) {
    vec2 remappedUv = remapProbeUv(probeUv);

    vec2 sampleUv1 = remappedUv + offsetForIndex(2 * probeIndex);
    vec2 sampleUv2 = remappedUv + offsetForIndex(2 * probeIndex + 1);

    return 0.5 * (
            sampleCascadeTexture(sampleUv1) 
            + sampleCascadeTexture(sampleUv2)
            );
}

vec4 castRay(int probeIndex, vec2 probeUv) {
    vec2 rayDirectionUv = toDirection(probeIndex, tauOverRayCount);

    int hitIndex = -1;
    float closestDist = 50.;

    #if (LINE_SEGMENT_COUNT > 0)
    for (int i = 0; i < LINE_SEGMENT_COUNT; i++) {
        float dist = hitLineDistance(probeUv,  rayDirectionUv,  lineSegments[i]);
        if (dist < closestDist) {
            hitIndex = i;
            closestDist = dist;
        }
    }
    #endif

    vec4 lineColor = vec4(0.);
    #if (LINE_SEGMENT_COUNT > 0)
    lineColor = lineSegments[hitIndex].color * float(closestDist < 10.) ;
    #endif
    float distToEdge = distToOutOfBounds(probeUv, rayDirectionUv) ;
    if (closestDist < maxDistance) {
      return lineColor;
    } else if (distToEdge >= maxDistance) {
      return sampleCascade(probeIndex, probeUv);
    }
    return vec4(0.,0.,0.,0.);
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

}