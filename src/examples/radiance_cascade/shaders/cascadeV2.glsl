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

uniform int rayCount;
uniform int xSize;
uniform float invPixelCountPerProbe;

uniform int deepXSize;
uniform float deeperUvPerProbe;

uniform float maxDistance;

varying vec2 vUv;

out vec4 outColor;

bool outOfBounds(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
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

    probeIndex = xIndex  + yIndex * xSize;
    probeUv = mod(uv * float(xSize), vec2(1.));
    if (xIndex >= xSize || yIndex >= xSize || probeIndex >=  rayCount) {
        probeIndex = -1;
    }
}

vec2 offsetForIndex(int deepIndex) {
    float xIndex = mod(float(deepIndex), float(deepXSize));
    float yIndex = floor(float(deepIndex)/ float(deepXSize));
    return vec2(xIndex, yIndex) * deeperUvPerProbe;
}

vec2 remapProbeUv(vec2 probeUv) {
  return minDeeperUv + (maxDeeperUv - minDeeperUv) * probeUv;
}

vec4 sampleCascadeTexture(vec2 uv) {
    if (outOfBounds(uv)) {
        return vec4(0.);
    } else {
        return texture2D(tPrevCascade, uv);
    }
}

vec4 sampleCascade(int probeIndex, vec2 probeUv) {
    vec2 offset1 = offsetForIndex(2 * probeIndex);
    vec2 offset2 = offsetForIndex(2 * probeIndex + 1);

    vec2 remappedUv1 = remapProbeUv(probeUv + maxDistance * toDirection(2 * probeIndex, tauOverDeeperRayCount));
    vec2 remappedUv2 = remapProbeUv(probeUv + maxDistance * toDirection(2 * probeIndex + 1, tauOverDeeperRayCount));

    vec4 rad = 0.5 * (
            sampleCascadeTexture(offset1 + remapProbeUv(probeUv)) 
            + sampleCascadeTexture(offset2 + remapProbeUv(probeUv))
            );
    return  rad;
}

vec4 castRay(int probeIndex, vec2 probeUv) {
    vec2 rayDirectionUv = toDirection(probeIndex, tauOverRayCount);
    vec2 originalSample = probeUv;

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
    if (closestDist < maxDistance) {
    #if (LINE_SEGMENT_COUNT > 0)
        return lineSegments[hitIndex].color;
    #endif
    // hit something, do some stuff
    } else {
        return sampleCascade(probeIndex, originalSample);
        // missed everything, see how far to edge?
    }
    return vec4(0., 0., 0., 1.);
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