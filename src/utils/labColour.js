import * as THREE from "three";
// struct Lab {float L; float a; float b;};
// struct RGB {float r; float g; float b;};

// Lab linear_srgb_to_oklab(RGB c)
// {
//     float l = 0.4122214708* c.r + 0.5363325363* c.g + 0.0514459929* c.b;
// 	float m = 0.2119034982* c.r + 0.6806995451* c.g + 0.1073969566* c.b;
// 	float s = 0.0883024619* c.r + 0.2817188376* c.g + 0.6299787005* c.b;

//     float l_ = cbrtf(l);
//     float m_ = cbrtf(m);
//     float s_ = cbrtf(s);

//     return {
//         0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
//         1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
//         0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_,
//     };
// }

// RGB oklab_to_linear_srgb(Lab c)
// {
//     float l_ = c.L + 0.3963377774* c.a + 0.2158037573* c.b;
//     float m_ = c.L - 0.1055613458* c.a - 0.0638541728* c.b;
//     float s_ = c.L - 0.0894841775* c.a - 1.2914855480* c.b;

//     float l = l_*l_*l_;
//     float m = m_*m_*m_;
//     float s = s_*s_*s_;

//     return {
// 		+4.0767416621* l - 3.3077115913* m + 0.2309699292* s,
// 		-1.2684380046* l + 2.6097574011* m - 0.3413193965* s,
// 		-0.0041960863* l - 0.7034186147* m + 1.7076147010* s,
//     };
// }

class OkLabColor extends THREE.Color {
  static fromLinearColor = (c) => {
    return OkLabColor.fromLinearRGB(c.r, c.b, c.g);
  };

  static fromLinearRGB = (r, g, b) => {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    const labB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

    return new OkLabColor(L, a, labB);
  };
  constructor(L, a, b) {
    super(L, a, b);
  }
}
export { OkLabColor };
