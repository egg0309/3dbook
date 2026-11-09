export const halftoneVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const halftoneFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform vec2 uResolution;
  uniform float uDpr;
  uniform float uTime;
  uniform float uProgress;
  uniform vec2 uMouse;
  uniform float uMouseActive;
  uniform float uCell;
  uniform float uAngle;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform float uAspA;
  uniform float uAspB;
  uniform float uZoomA;
  uniform float uZoomB;
  uniform vec2 uPanA;
  uniform vec2 uPanB;

  varying vec2 vUv;

  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  mat2 rot2(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  vec2 coverUv(vec2 uv, float texAspect, float zoom, vec2 pan) {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 scale = vec2(1.0);
    if (screenAspect > texAspect) {
      scale.y = texAspect / screenAspect;
    } else {
      scale.x = screenAspect / texAspect;
    }
    vec2 result = (uv - 0.5) * scale / zoom + 0.5 + pan;
    return clamp(result, vec2(0.002), vec2(0.998));
  }

  void main() {
    vec2 fragPx = gl_FragCoord.xy / uDpr;
    vec2 center = uResolution * 0.5;
    mat2 rotate = rot2(uAngle);
    mat2 rotateBack = rot2(-uAngle);

    vec2 rotatedPx = rotate * (fragPx - center) + center;
    vec2 cellId = floor(rotatedPx / uCell);
    vec2 cellCenterPx = (cellId + 0.5) * uCell;
    vec2 sourcePx = rotateBack * (cellCenterPx - center) + center;
    vec2 cellUv = sourcePx / uResolution;
    vec2 local = fract(rotatedPx / uCell) - 0.5;
    float distPx = length(local) * uCell;

    vec2 uvA = coverUv(cellUv, uAspA, uZoomA, uPanA);
    vec2 uvB = coverUv(cellUv, uAspB, uZoomB, uPanB);
    vec3 sampleA = texture2D(uTexA, uvA).rgb;
    vec3 sampleB = texture2D(uTexB, uvB).rgb;
    float lumaA = dot(sampleA, LUMA);
    float lumaB = dot(sampleB, LUMA);

    float sweep = vUv.x * 0.62 + (1.0 - vUv.y) * 0.38;
    sweep += (valueNoise(vUv * vec2(5.0, 3.2) + vec2(uTime * 0.018, 0.0)) - 0.5) * 0.11;
    float edge = uProgress * 1.28 - 0.14;
    float reveal = 1.0 - smoothstep(edge - 0.06, edge + 0.06, sweep);
    float edgeGlow =
      (1.0 - smoothstep(0.0, 0.11, abs(sweep - edge))) *
      smoothstep(0.0, 0.08, uProgress) *
      (1.0 - smoothstep(0.92, 1.0, uProgress));

    float aa = max(fwidth(distPx) * 1.2, 0.55);
    float radiusA = sqrt(clamp(lumaA, 0.0, 1.0)) * uCell * 0.63 * (1.0 + edgeGlow * 0.22);
    float radiusB = sqrt(clamp(lumaB, 0.0, 1.0)) * uCell * 0.63 * (1.0 + edgeGlow * 0.5);
    float coverageA = 1.0 - smoothstep(radiusA - aa, radiusA + aa, distPx);
    float coverageB = 1.0 - smoothstep(radiusB - aa, radiusB + aa, distPx);
    float coverage = mix(coverageA, coverageB, reveal);

    vec3 color = mix(uPaper, uInk, coverage);
    color += uAccent * edgeGlow * (0.03 + coverage * 0.09);

    vec2 colorUvA = coverUv(vUv, uAspA, uZoomA, uPanA);
    vec2 colorUvB = coverUv(vUv, uAspB, uZoomB, uPanB);
    vec3 photo = mix(
      texture2D(uTexA, colorUvA).rgb,
      texture2D(uTexB, colorUvB).rgb,
      reveal
    );
    photo = clamp((photo - 0.5) * 1.06 + 0.52, 0.0, 1.0);
    photo *= vec3(1.06, 1.0, 0.91);

    // 做旧照片调色：保留原图结构，让半调网点像印在历史影像上
    float photoLuma = dot(photo, LUMA);
    vec3 sepia = vec3(photoLuma) * vec3(1.18, 0.96, 0.76);
    vec3 graded = mix(photo, sepia, 0.55) * 0.72;
    color = mix(color, graded, 0.55);

    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    float mouseDist = length((vUv - uMouse) * aspect);
    float cursor = 1.0 - smoothstep(0.142, 0.188, mouseDist);
    cursor *= uMouseActive;
    float ring =
      smoothstep(0.142, 0.188, mouseDist) *
      (1.0 - smoothstep(0.188, 0.235, mouseDist));
    color = mix(color, photo, cursor * 0.94);
    color += uAccent * ring * 0.06 * uMouseActive;

    color *= 0.9 + 0.1 * valueNoise(vUv * 6.0 + vec2(uTime * 0.02, 0.0));

    vec2 q = (vUv - 0.5) * vec2(1.0, 1.22);
    float vignette = smoothstep(0.88, 0.24, length(q));
    color *= mix(0.3, 1.0, vignette);

    float topFade = smoothstep(1.0, 0.74, vUv.y);
    color *= mix(0.52, 1.0, topFade);
    float bottomFade = smoothstep(0.0, 0.26, vUv.y);
    color *= mix(0.54, 1.0, bottomFade);

    float grain = hash21(fragPx + floor(uTime * 18.0)) - 0.5;
    color += grain * 0.035;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;
