
uniform sampler2D tTarget;

uniform bool isSdf;

uniform vec2 start;
uniform vec2 end;

uniform vec3 color;
uniform float radius;

varying vec2 vUv;
out vec4 outColor;
  
  float sdfDist(vec2 p) {
  
      vec2 toStart = p - start;
      vec2 line = end - start;
      float lineLengthSquared = dot(line, line);
      float t = clamp(dot(toStart, line) / lineLengthSquared, 0., 1.);
      vec2 closest = (toStart - line * t);
      return length(closest) - radius ;
  }
  
  void main()
  { 
      vec4 current = texture2D(tTarget,vUv);
      float dist = sdfDist(vUv);
      if (isSdf) {
        outColor = vec4(min(dist, current.x), vec3(0.));
      } else {
        float inRange = smoothstep (0., 0.0025,dist);
        outColor = inRange * current + (1. - inRange) * vec4(color, 1.);
      }
  }
