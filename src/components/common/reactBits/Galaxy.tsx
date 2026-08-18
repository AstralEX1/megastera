import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uDensity;
uniform float uGlow;
varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float starLayer(vec2 uv, float scale, float seedOffset) {
  vec2 p = uv * scale;
  vec2 id = floor(p);
  vec2 gv = fract(p) - 0.5;
  float value = 0.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 cell = id + offset + seedOffset;
      float seed = hash21(cell);
      vec2 jitter = vec2(hash21(cell + 4.1), hash21(cell + 8.7)) - 0.5;
      float distanceToStar = length(gv - offset - jitter * 0.58);
      float rarity = step(1.0 - 0.035 * uDensity, seed);
      float twinkle = 0.78 + 0.22 * sin(uTime * (0.35 + seed) + seed * 31.4);
      float star = smoothstep(0.055, 0.0, distanceToStar) * rarity * twinkle;
      float halo = (0.0022 / max(distanceToStar, 0.025)) * rarity * twinkle;
      value += star + halo;
    }
  }

  return value;
}

void main() {
  vec2 uv = (vUv * uResolution.xy - 0.5 * uResolution.xy) / uResolution.y;
  float stars = 0.0;
  stars += starLayer(uv, 8.0, 0.0);
  stars += starLayer(uv + 2.7, 13.0, 17.0) * 0.72;
  stars += starLayer(uv - 1.3, 20.0, 41.0) * 0.46;

  vec3 coolWhite = vec3(0.82, 0.86, 1.0);
  vec3 violet = vec3(0.68, 0.72, 1.0);
  float tint = 0.5 + 0.5 * sin((uv.x + uv.y) * 2.0);
  vec3 color = mix(coolWhite, violet, tint) * stars * uGlow;
  float alpha = clamp(length(color) * 1.35, 0.0, 0.72);
  gl_FragColor = vec4(color, alpha);
}
`;

type GalaxyProps = {
  className?: string;
  density?: number;
  glowIntensity?: number;
  speed?: number;
};

/**
 * Lightweight OGL star field adapted from the layered React Bits Galaxy background.
 * https://github.com/DavidHDev/react-bits
 */
export function Galaxy({
  className = '',
  density = 0.42,
  glowIntensity = 0.16,
  speed = 0.18,
}: GalaxyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof WebGLRenderingContext === 'undefined') return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: false, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Float32Array([1, 1]) },
        uDensity: { value: density },
        uGlow: { value: glowIntensity },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      program.uniforms.uResolution.value[0] = gl.canvas.width;
      program.uniforms.uResolution.value[1] = gl.canvas.height;
    };

    resize();
    window.addEventListener('resize', resize);
    container.appendChild(gl.canvas);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    let frame = 0;
    const render = (time: number) => {
      program.uniforms.uTime.value = time * 0.001 * speed;
      renderer.render({ scene: mesh });
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };

    if (reduceMotion) {
      renderer.render({ scene: mesh });
    } else {
      frame = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      if (gl.canvas.parentNode === container) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [density, glowIntensity, reduceMotion, speed]);

  return (
    <div
      ref={containerRef}
      data-react-bits="galaxy"
      aria-hidden="true"
      className={`relative h-full w-full bg-[radial-gradient(circle_at_24%_18%,rgba(174,185,255,0.05),transparent_28%),radial-gradient(circle_at_78%_62%,rgba(178,140,255,0.035),transparent_24%)] ${className}`}
    />
  );
}
