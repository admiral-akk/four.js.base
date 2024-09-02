export const sobelFragShader = `
  #include <packing>
  
  uniform float cameraNear;
  uniform float cameraFar;
  
  uniform float textureWidth;
  uniform float textureHeight;
  
  uniform float pixelWidth;
  
  uniform vec3 cameraDir;
  uniform vec3 cameraUp;
  uniform vec3 cameraRight;
  
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  
  uniform float fov;
  uniform float aspect;
  
  uniform float normalStrength;
  uniform float depthStrength;
  
  varying vec2 vUv;
  
  float readDepth( sampler2D depthSampler, vec2 coord ) {
      float fragCoordZ = texture2D( depthSampler, coord ).x;
      float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar);
      return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
   }
   
   float linearize_depth(in float depth){
       float a = cameraFar / (cameraFar - cameraNear);
       float b = cameraFar * cameraNear / (cameraNear - cameraFar);
       return a + b / depth;
   }
   
   float reconstruct_depth(const in vec2 uv){
       float depth = texture2D(tDepth, uv).x;
       return pow(2.0, depth * log2(cameraFar + 1.0)) - 1.0;
   }
   
   float dotM(mat3 matrix1, mat3 matrix2) {
      return dot(matrix1[0], matrix2[0])
         + dot(matrix1[1], matrix2[1])
         + dot(matrix1[2], matrix2[2]);
   } 
   
   float sobelM(mat3 values) {
               const mat3 Gx = mat3( -3, -10, -3, 0, 0, 0, 3, 10, 3 ); // x direction kernel
               const mat3 Gy = mat3( -3, 0, 3, -10, 0, 10, -3, 0, 3 ); // y direction kernel
   
            float dx = dotM(values, Gx);
            float dy = dotM(values, Gy);
   
               return ( dx*dx ) + ( dy * dy );
   }
  
   void main()
   {  
      vec2 texel = pixelWidth * vec2( 1.0 / textureWidth, 1.0 / textureHeight );
   
      vec3 normal = texture2D(tNormal, vUv ).rgb;
      vec3 n = texture2D(tNormal, vUv + vec2(0.0, -texel.y)).rgb;
      vec3 s = texture2D(tNormal, vUv + vec2(0.0, texel.y)).rgb;
      vec3 e = texture2D(tNormal, vUv + vec2(texel.x, 0.0)).rgb;
      vec3 w = texture2D(tNormal, vUv + vec2(-texel.x, 0.0)).rgb;
      vec3 nw = texture2D(tNormal, vUv + vec2(-texel.x, -texel.y)).rgb;
      vec3 ne = texture2D(tNormal, vUv + vec2(texel.x, -texel.y)).rgb;
      vec3 sw = texture2D(tNormal, vUv + vec2(-texel.x, texel.y)).rgb;
      vec3 se = texture2D(tNormal, vUv + vec2(texel.x, texel.y)).rgb;
   
      mat3 normal_r =  mat3(
         vec3(nw.r, n.r, ne.r),
         vec3(w.r, normal.r, e.r),
         vec3(sw.r, s.r, se.r)
      );
      mat3 normal_g =   mat3(
         vec3(nw.g, n.g, ne.g),
         vec3(w.g, normal.g, e.g),
         vec3(sw.g, s.g, se.g)
      );
      mat3 normal_b = mat3(
         vec3(nw.b, n.b, ne.b),
         vec3(w.b, normal.b, e.b),
         vec3(sw.b, s.b, se.b)
      );
   
   
      float tx0y0 = reconstruct_depth( vUv + texel * vec2( -1, -1 ) );
      float tx0y1 = reconstruct_depth( vUv + texel * vec2( -1,  0 ) );
      float tx0y2 = reconstruct_depth( vUv + texel * vec2( -1,  1 ) );
      // second column  
   
      float tx1y0 = reconstruct_depth( vUv + texel * vec2(  0, -1 ) );
      float tx1y1 = reconstruct_depth( vUv + texel * vec2(  0,  0 ) );
      float tx1y2 = reconstruct_depth( vUv + texel * vec2(  0,  1 ) );
   
      // third column
   
      float tx2y0 = reconstruct_depth( vUv + texel * vec2(  1, -1 ) );
      float tx2y1 = reconstruct_depth( vUv + texel * vec2(  1,  0 ) );
      float tx2y2 = reconstruct_depth( vUv + texel * vec2(  1,  1 ) );
      
      mat3 mat_depth = mat3(
         vec3(tx0y0, tx1y0,tx2y0),
         vec3(tx1y0, tx1y1, tx1y2),
         vec3(tx2y0, tx2y1,tx2y2)
      ) / cameraFar;
   
      vec3 fixedNormal = normalize(normal - 0.5);
      vec3 fixedCameraDir = normalize(cameraDir) 
         + cameraRight * tan(aspect * fov * (vUv.x - 0.5));
         + cameraUp * tan( fov * (vUv.y - 0.5));
   
      // For each pixel movement, how far do I move along the surface?
      float stepSize = abs(1. - dot(fixedNormal, normalize(fixedCameraDir)));
   
      vec3 sobelNormal = vec3(sobelM(normal_r),sobelM(normal_g),sobelM(normal_b));
      
      float sobelDepth = sobelM(mat_depth);
   
      float edgeValue = normalStrength * dot(vec3(1.), sobelNormal) 
                             + depthStrength * sobelDepth / stepSize ;
      float sobel = step( 0.15, edgeValue);
   
      gl_FragColor = vec4(sobel);
   }
  `;

export const fillFragShader = `
  uniform sampler2D tInput;
  
  uniform float textureWidth;
  uniform float textureHeight;
  
  uniform float xPixelJump;
  uniform float yPixelJump;
  
  varying vec2 vUv;
  
   void main()
   {  
      vec2 offset = vec2(xPixelJump / textureWidth, yPixelJump / textureHeight);
      vec4 left =  texture2D(tInput, vUv - offset);
      vec4 middle =  texture2D(tInput, vUv);
      vec4 right =  texture2D(tInput, vUv + offset);
   
      gl_FragColor = max(max(left, right), middle);
   }
  
  `;

export const crossHatchFrag = `
  uniform sampler2D tShadow;
  uniform sampler2D tWorldPos;
  
  uniform float textureWidth;
  uniform float textureHeight;
  
  uniform float noiseScale;
  uniform float noiseFrequency;
  
  uniform float thickness;
  uniform float scale;
  uniform float frequency;
  
  varying vec2 vUv;
  
  //	Simplex 3D Noise 
  //	by Ian McEwan, Ashima Arts
  //
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  
  float snoise(vec3 v) { 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  
  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;
  
  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
  
    //  x0 = x0 - 0. + 0.0 * C 
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;
  
  // Permutations
    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  
  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;
  
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)
  
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
  
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
  
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
  
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
  
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
  
  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
  
  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }
  
  
  float htex(in vec2 p, in float lum ) { 
      float e = thickness * length(vec2(dFdx(p.x), dFdy(p.y))); 
     
      float noise = noiseScale*snoise(noiseFrequency * texture2D(tWorldPos, vUv).xyz);
  
    if (lum < 0.5) {
      float v = abs(mod(p.x + p.y + noise, 10.0));
      if (v < e) {
        return 0.;
      }
    }
    
    if (lum < 0.4) {
      float v = abs(mod(p.x - p.y + noise, 10.0));
      if (v < e) {
        return 0.;
      }
    }
    
    if (lum < 0.3) {
      float v = abs(mod(p.x + p.y - 5.0 + noise, 10.0));
      if (v < e) {
        return 0.;
      }
    }
    
    if (lum < 0.2) {
      float v = abs(mod(p.x - p.y - 5.0 + noise, 10.0));
      if (v < e) {
        return 0.;
      }
    }
  
    if (lum < 0.1) {
      float v = abs(mod(p.x + p.y - 7.5 + noise, 10.0));
      if (v < e) {
        return 0.;
      }
    }
   
    return 1.;
  }
  
  void main()
  {
      vec2 size = vec2(textureSize(tShadow, 0));
     float lum = texture2D(tShadow, vUv).r;
     float isHatch =  1. - htex(vUv * size * scale ,lum);
     gl_FragColor = vec4(isHatch);
  }
  
  `;

export const combineFragShader = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tSobel;
  uniform sampler2D tHatch;
  
  varying vec2 vUv;
  
   void main()
   {  
      vec4 diffuse = texture2D(tDiffuse, vUv);
      vec4 sobel = texture2D(tSobel, vUv);
      vec4 hatch = texture2D(tHatch, vUv);
  
      float sobelMask = (1. - step( sobel.a, 0.2));
      float hatchMask = (1. - step( hatch.a, 0.2));
   
      vec3 color = (1. - sobelMask) * (1. - hatchMask) * diffuse.rgb;
   
      gl_FragColor = vec4(color, 1.);
   }
  `;

export const renderTextureFrag = `
  uniform sampler2D tInput;
  
  varying vec2 vUv;
out vec4 outColor;
  
   void main()
   {  
      outColor  = texture2D(tInput,vUv);
   }
  `;

export const labToLinearFragShader = `
#include <packing>
precision highp  float;
precision highp  sampler2D;

uniform sampler2D tInput;
struct Lab {float L; float a; float b;};
struct RGB {float r; float g; float b;};

RGB oklab_to_linear_srgb(Lab c) 
{
    float l_ = c.L + 0.3963377774f * c.a + 0.2158037573f * c.b;
    float m_ = c.L - 0.1055613458f * c.a - 0.0638541728f * c.b;
    float s_ = c.L - 0.0894841775f * c.a - 1.2914855480f * c.b;

    float l = l_*l_*l_;
    float m = m_*m_*m_;
    float s = s_*s_*s_;

    return RGB(
		+4.0767416621f * l - 3.3077115913f * m + 0.2309699292f * s,
		-1.2684380046f * l + 2.6097574011f * m - 0.3413193965f * s,
		-0.0041960863f * l - 0.7034186147f * m + 1.7076147010f * s
  );
}

varying vec2 vUv;

 void main()
 {  
    vec4 inp = vec4(texture2D(tInput, vUv));
    Lab color = Lab(inp.x,inp.y,inp.z);

    RGB linearColor = oklab_to_linear_srgb(color);
     inp = vec4(linearColor.r,linearColor.g,linearColor.b, inp.w);
    gl_FragColor = inp;
 }
`;

export const gradientFragShader = `
#include <packing>
precision highp  float;
precision highp  sampler2D;

uniform sampler2D tInput;
uniform vec3 uStartColor;
uniform vec3 uEndColor;

varying vec2 vUv;

 void main()
 {  
    vec3 color = mix(uStartColor, uEndColor, vUv.x);
    vec4 inp = vec4(color, 1.);
    gl_FragColor = inp;
 }
`;

export const gammaFragShader = `
  #include <packing>
  precision mediump  float;
  precision mediump  sampler2D;
  uniform sampler2D tInput;
  
  varying vec2 vUv;
  
   void main()
   {  
      vec4 inp = vec4(texture2D(tInput, vUv));
      vec3 color = pow(inp.xyz, vec3(1./2.2));
      gl_FragColor = vec4(color, inp.w);
   }
  `;
