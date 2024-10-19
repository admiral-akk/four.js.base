#version 300 es
precision mediump float;

#define PI 3.141592654 
#define TAU (2.0*PI)
#define BAD_PROBE_INDEX_COLOR vec4(1.,1.,0.,1.);
#define DEBUG_COLOR vec4(0.,1.,1.,1.);
#define RESERVED_COLOR vec4(0.5,0.5,0.,1.);

struct CascadeConfig { 
  float depth;
  float minDistance;
  float maxDistance;
};

struct DebugInfo {
  bool continousBilinearFix;
  bool cornerProbes;
  bool showSampleUv;
  bool showProbeUv;
  bool showDirection;
};

uniform vec2 resolution;
uniform vec2 renderResolution;
uniform int maxSteps;
uniform sampler2D tDistance;
uniform sampler2D tColor;
uniform int startDepth;
uniform CascadeConfig current;
uniform CascadeConfig deeper;
uniform DebugInfo debug;
uniform sampler2D tPrevCascade;

out vec4 outColor;

bool outOfBounds(vec2 uv) {
  return uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.;
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
    texture(tPrevCascade, indicesToSampleUv(sampleTarget)) 
    + texture(tPrevCascade, indicesToSampleUv(sampleTarget2))  
  );
}

vec4 sampleSky(vec2 dir) {
  return vec4(0., 0., 0., 1.);
}

vec4 castRay(vec2 start, vec2 end, ivec4 sampleTarget, ivec4 sampleTarget2) {
  vec2 delta = end-start;
  float distanceLeft = length(delta);
  float minStep2 = 4. / float(textureSize(tColor, 0).x);
  vec2 dir = delta / distanceLeft;
  for (int i = 0; i < maxSteps; i++) {
    if (distanceLeft < 0.) {
      return sampleTexture(sampleTarget, sampleTarget2);
    }

    if (outOfBounds(start)) {
      return sampleSky(dir);
    }
    
    float sdf = texture(tDistance, start).r ;
    vec4 color = texture(tColor, start);
    if (color.a > 0.99) {
      return texture(tColor, start);
    }

    sdf += minStep2;
    start += sdf * dir;
    distanceLeft -= sdf;
  }

  return sampleTexture(sampleTarget, sampleTarget2);
}


// gets the uv of the probe for this index
vec2 indicesToProbeUv(ivec4 probeIndex) {

  float probeCount = float((int(textureSize(tPrevCascade, 0).x) / 4) >> probeIndex.w);
  if (debug.cornerProbes) {
    vec2 zeroToOne = vec2(probeIndex.xy) / (probeCount - 1.);
    vec2 delta = 1. / renderResolution;
    return zeroToOne * (1. - delta) + 0.5 * delta; 
  } else {
    return (vec2(probeIndex.xy) + 0.5) / probeCount; 
  }
}

ivec4 topLeftIndex(ivec4 probeIndex) {
  if (debug.cornerProbes) {
  float probeCount = float((int(textureSize(tPrevCascade, 0).x) / 4) >> (probeIndex.w));
    vec2 zeroToOne = vec2(probeIndex.xy) / (probeCount - 1.);
    int deeperProbeCount = int(0.5 * probeCount  - 1.);
    ivec2 topLeftProbe = ivec2(floor(float(deeperProbeCount) * zeroToOne));
    if (topLeftProbe.x == deeperProbeCount ) {
      topLeftProbe.x = deeperProbeCount - 1;
    }
    if (topLeftProbe.y == deeperProbeCount) {
      topLeftProbe.y = deeperProbeCount - 1;
    }
    return ivec4(
      topLeftProbe.x,
      topLeftProbe.y, 
    2 * probeIndex.z,
    probeIndex.w + 1
  );
  } else {
    return ivec4(
    int(floor(float(probeIndex.x - 1 ) / 2.)),
    int(floor(float(probeIndex.y - 1 ) / 2.)),
    2 * probeIndex.z,
    probeIndex.w + 1
  );
  }
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

vec4 continousbilinearFix(ivec4 probeIndex) { 
  vec2 probeUv = indicesToProbeUv(probeIndex);

  ivec4 indexTL = topLeftIndex(probeIndex);

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

  vec2 start = lineSegmentUv(probeIndex, current.minDistance);

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


  vec2 probeTL = indicesToProbeUv(indexTL);
  vec2 probeBR = indicesToProbeUv(indexBR);

  vec2 weights = (probeUv - probeTL) / (probeBR - probeTL);

  vec4 top = mix(radTL, radTR, vec4(weights.x));
  vec4 bot = mix(radBL, radBR, vec4(weights.x));

  return mix(top, bot, vec4(weights.y));

}

vec4 bilinearFix(ivec4 probeIndex) {
  vec2 probeUv = indicesToProbeUv(probeIndex);

  ivec4 indexTL = topLeftIndex(probeIndex);

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

  vec4 top = mix(radTL, radTR, vec4(weights.x));
  vec4 bot = mix(radBL, radBR, vec4(weights.x));

  return mix(top, bot, vec4(weights.y));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  ivec4 newIndex = sampleUvToIndices(uv);
  if (newIndex.w != int(current.depth)) {
    outColor = texture(tPrevCascade, uv);
  } else if (current.depth == float(startDepth)) {
    vec2 start = lineSegmentUv(newIndex, current.minDistance);
    vec2 end = lineSegmentUv(newIndex, current.maxDistance);
    outColor = castRay(start, end, ivec4(-10), ivec4(-10));
  } else if (debug.continousBilinearFix) {
    outColor = continousbilinearFix(newIndex);
  } else {
    outColor = bilinearFix(newIndex);
  }

  
  ivec4 indexTL = topLeftIndex(newIndex);

  if (debug.showSampleUv) {
    ivec2 texSize = textureSize(tPrevCascade, 0);
    vec2 sampledUv = vec2(indexTL.xy) / float(texSize.x >> (indexTL.w + 2));
    outColor.rg = sampledUv;
  }
  
  if (debug.showProbeUv) {
    vec2 sampledUv = indicesToProbeUv(newIndex) ;
    outColor.rg = sampledUv;
  }
  
  if (debug.showDirection) {
    outColor.r = float(indexTL.z) /  float(4 << newIndex.w);
  }
  outColor.w = 1.;
}
