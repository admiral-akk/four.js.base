#version 300 es
precision mediump float;

#define PI 3.141592654 
#define TAU (2.0*PI)
#define BAD_PROBE_INDEX_COLOR vec4(1.,1.,0.,1.);
#define DEBUG_COLOR vec4(0.,1.,1.,1.);
#define RESERVED_COLOR vec4(0.5,0.5,0.,1.);

struct CascadeConfig { 
  int depth;
  float minDistance;
  float maxDistance;
};

struct DebugInfo {
  bool continousBilinearFix;
  bool cornerProbes;
  bool showSampleUv;
  bool showProbeUv;
  bool showDirection;
  bool noFix;
  bool quadSample;
  int finalDepth;
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

vec4 sampleSky(vec2 dir) {
  return vec4(0., 0., 0., 1.);
}

vec4 castRay(vec2 start, vec2 end) {
vec2 initialStart = start;
  vec2 delta = end - start;
  float distanceLeft = length(delta);
  float minStep = 2. / float(textureSize(tColor, 0).x);
  vec2 dir = delta / distanceLeft;
  for (int i = 0; i < maxSteps; i++) {
    if (distanceLeft < 0.) {
        return vec4(0.);
    }

    if (outOfBounds(start)) {
      return sampleSky(dir);
    }
    
    float sdf = texture(tDistance, start).r ;
    vec4 color = texture(tColor, start);
    if (color.a > 0.9) {
      color *= pow(0.01, length(start - initialStart));
      return color;
    }

    sdf += minStep;
    start += sdf * dir;
    distanceLeft -= sdf;
  }
  return vec4(0.);
}


// gets the uv of the probe for this index
vec2 indicesToProbeUv(ivec4 probeIndex) {
    float probeCount = float(textureSize(tPrevCascade, 0).x >> (probeIndex.w + 1));
    vec2 zeroToOne = vec2(probeIndex.xy) / (probeCount - 1.);
    vec2 delta = 1. / renderResolution;
    return zeroToOne * (1. - delta) + 0.5 * delta; 
}

int imod(int v, int m) {
    return int(mod(float(v),float(m)));
}

ivec2 imod(ivec2 v, int m) {
    return ivec2(mod(vec2(v),float(m)));
}

ivec3 imod(ivec3 v, int m) {
    return ivec3(mod(vec3(v),float(m)));
}

ivec4 imod(ivec4 v, int m) {
    return ivec4(mod(vec4(v),float(m)));
}

vec2 indicesToSampleUv(ivec4 index) {
    ivec2 texSize = textureSize(tPrevCascade, 0);
    vec2 pixelSizeInUv = 1. / vec2(texSize); 

    vec2 probeOffset = (vec2(index.xy) + 0.5) * pixelSizeInUv;

    int probePerDim = texSize.x >>  (index.w + 1);
    int dirDivison = texSize.x / probePerDim;
    ivec2 gridCoord = ivec2( imod(index.z,dirDivison),index.z / dirDivison);

    vec2 directionOffset = vec2(gridCoord) * pixelSizeInUv * float(probePerDim);

    return probeOffset + directionOffset;
}

vec4 indicesToProbeDir(ivec4 index) {
    float tauOverIndexRayCount = TAU / float(4 << (2 * index.w));
    float angle = tauOverIndexRayCount * (float(index.z) + 0.5);
    vec2 dir = vec2(cos(angle), -sin(angle));

    float probeCount = float(textureSize(tPrevCascade, 0).x >> (index.w + 1));
    vec2 zeroToOne = vec2(index.xy) / (probeCount - 1.);
    vec2 delta = 1. / renderResolution;
    vec2 probeUv = zeroToOne * (1. - delta) + 0.5 * delta; 

    return vec4(probeUv, dir);
}

// gets the index that corresponds to this texture uv
ivec4 sampleUvToIndices(ivec2 coord) {
    int probePerDim = textureSize(tPrevCascade, 0).x >> (current.depth + 1);
    ivec2 gridCoord = coord / probePerDim;
    ivec2 probeCoord = imod(coord, probePerDim);

    int sqrtDirectionCount = textureSize(tPrevCascade, 0).x / probePerDim;

    int direction = gridCoord.x + sqrtDirectionCount * gridCoord.y;
    return ivec4(probeCoord, direction, current.depth);
}

vec2 lineSegmentUv(ivec4 probeIndex, float distance) {
  vec4 probeUvDir = indicesToProbeDir(probeIndex);
  return probeUvDir.xy + distance * probeUvDir.zw;
}

ivec4 topLeftIndex(ivec4 probeIndex) {
    float probeCount = float(textureSize(tPrevCascade, 0).x >> (probeIndex.w + 1));
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
        4 * probeIndex.z,
        probeIndex.w + 1
    );
}

vec4 sampleCascade(ivec4 deeperIndex) {
    vec4 rad = vec4(0.);
    if (rad.a < 0.5) {
        for (int i = 0; i < 4; i++) {
            rad += texture(tPrevCascade, indicesToSampleUv(deeperIndex + ivec4(0,0,i,0)));
        }
        rad *= 0.25;
    } 
    return rad;

}

vec4 bilinearRaycast(
    vec2 start,
    vec2 end,
    vec2 probeUv,
    vec2 deeperUv,
    ivec4 deeperIndex
) {
    vec4 rad = castRay(start, end + (deeperUv - probeUv));
    if (rad.a < 0.05) {
        rad = sampleCascade(deeperIndex);
        rad *= pow(0.01, current.maxDistance - current.minDistance);
    } 
    return rad;
}

void main() {
    ivec4 index = sampleUvToIndices(ivec2(gl_FragCoord.xy));
    
    if (debug.noFix) {
        vec2 start = lineSegmentUv(index, current.minDistance);
        vec2 end = lineSegmentUv(index, current.maxDistance);
        outColor = castRay(start, end);
    
        if (outColor.w < 0.5) {
            ivec4 indexTL = topLeftIndex(index);
            ivec4 indexBR = indexTL + ivec4(1,1,0,0);

            vec2 probe = indicesToProbeUv(index);
            vec2 probeTL = indicesToProbeUv(indexTL);
            vec2 probeBR = indicesToProbeUv(indexBR);

            vec2 weights = (probe - probeTL) / (probeBR - probeTL);

            vec2 sample1 = mix(indicesToSampleUv(indexTL), indicesToSampleUv(indexBR), weights);
            vec2 sample2 = mix(indicesToSampleUv(indexTL + ivec4(0,0,1,0)), 
                                indicesToSampleUv(indexBR + ivec4(0,0,1,0)), 
                                weights);
            vec2 sample3 = mix(indicesToSampleUv(indexTL + ivec4(0,0,2,0)), 
                                indicesToSampleUv(indexBR + ivec4(0,0,2,0)), 
                                weights);
            vec2 sample4 = mix(indicesToSampleUv(indexTL + ivec4(0,0,3,0)), 
                                indicesToSampleUv(indexBR + ivec4(0,0,3,0)), 
                                weights);

            outColor = 0.25 * (
                texture(tPrevCascade, sample1) +
                texture(tPrevCascade, sample2) +
                texture(tPrevCascade, sample3) +
                texture(tPrevCascade, sample4) 
            );
        }
    } else {
        vec4 probeUvDir = indicesToProbeDir(index);
        ivec4 indexTL = topLeftIndex(index);
        vec2 probeTL = indicesToProbeUv(indexTL);
        ivec4 indexTR = indexTL + ivec4(1, 0, 0, 0);
        vec2 probeTR = indicesToProbeUv(indexTR); 
        ivec4 indexBL = indexTL + ivec4(0, 1, 0, 0);
        vec2 probeBL = indicesToProbeUv(indexBL);
        ivec4 indexBR = indexTL + ivec4(1, 1, 0, 0);
        vec2 probeBR = indicesToProbeUv(indexBR);
        
        vec2 start = probeUvDir.xy + current.minDistance * probeUvDir.zw;
        vec2 end = probeUvDir.xy + current.maxDistance * probeUvDir.zw;

        vec4 radTL = bilinearRaycast(start, end,probeUvDir.xy, probeTL, indexTL);
        vec4 radTR = bilinearRaycast(start, end,probeUvDir.xy, probeTR, indexTR);
        vec4 radBL = bilinearRaycast(start, end,probeUvDir.xy, probeBL, indexBL);
        vec4 radBR = bilinearRaycast(start, end,probeUvDir.xy, probeBR, indexBR);

        vec2 weights = (probeUvDir.xy - probeTL) / (probeBR - probeTL);

        vec4 top = mix(radTL, radTR, vec4(weights.x));
        vec4 bot = mix(radBL, radBR, vec4(weights.x));

        outColor =  mix(top, bot, vec4(weights.y));
    }


    outColor.w = 1.;
}
