uniform sampler2D tInput;

uniform vec2 normal;
uniform float diffScale;

varying vec2 vUv;

out vec4 outColor;

vec2 flipUv() {
    return vUv - 2. * dot(vUv - 0.5, normal) * normal;
}

  void main() {
    vec4 color = texture2D(tInput, vUv);
    vec4 symmetryColor = texture2D(tInput, flipUv());
    vec3 diff = diffScale * abs(color.rgb - symmetryColor.rgb);
    outColor = vec4(diff.rgb, 1.);
  }
