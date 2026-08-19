import * as THREE from 'three'

/**
 * textures.js
 * Procedural ground textures, generated on a <canvas> at runtime.
 *
 * Why generate rather than load image files: the project stays asset-free and
 * works offline, with no texture downloads and no licensing questions. The
 * trade-off is a few milliseconds of setup on first load, which is why every
 * generator here is memoised by the caller.
 *
 * Each surface gets a colour map plus a normal map derived from the same
 * height field, so the lighting and the colouring agree with each other. That
 * agreement is most of what separates "textured" from "realistic".
 */

/* ------------------------------------------------------------------ *
 * Noise
 * ------------------------------------------------------------------ */

/** Deterministic hash — same seed always produces the same field. */
function hash2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

/** Value noise with bilinear interpolation. */
function valueNoise(x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smoothstep(x - xi)
  const yf = smoothstep(y - yi)

  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)

  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}

/**
 * Fractal brownian motion — several octaves of noise stacked at halving
 * amplitude. This is what gives soil both broad patches and fine grain.
 *
 * @returns {Float32Array} height values in 0..1, row-major, size × size
 */
function fbm(size, { scale = 8, octaves = 5, seed = 1, tile = true } = {}) {
  const out = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 1
      let freq = scale
      let sum = 0
      let norm = 0

      for (let o = 0; o < octaves; o++) {
        const u = (x / size) * freq
        const v = (y / size) * freq
        // Wrapping the lookup keeps the texture seamless when repeated.
        const value = tile
          ? valueNoise(u % freq, v % freq, seed + o)
          : valueNoise(u, v, seed + o)
        sum += value * amp
        norm += amp
        amp *= 0.5
        freq *= 2
      }

      const h = sum / norm
      out[y * size + x] = h
      if (h < min) min = h
      if (h > max) max = h
    }
  }

  // Normalise to the full 0..1 range so contrast is predictable.
  const span = max - min || 1
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / span

  return out
}

/* ------------------------------------------------------------------ *
 * Height field → normal map
 * ------------------------------------------------------------------ */

/**
 * Derives a tangent-space normal map by sampling the height field's slope.
 * Wrapping the neighbour lookups keeps the result seamless.
 */
function normalMapFromHeight(height, size, strength = 2.2) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)

  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength

      // Normalise the (dx, dy, 1) slope vector into 0..255 colour space.
      const len = Math.sqrt(dx * dx + dy * dy + 1)
      const i = (y * size + x) * 4
      image.data[i] = ((dx / len) * 0.5 + 0.5) * 255
      image.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      image.data[i + 2] = (1 / len) * 255
      image.data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

function toTexture(canvas, { srgb = false, repeat = 1, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = anisotropy
  // Colour maps carry sRGB values; normal and roughness maps are raw data and
  // must stay linear or the lighting goes wrong.
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

function blankCanvas(size) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  return canvas
}

/** Mixes two hex colours in linear-ish space and returns an rgb() string. */
function mix(colorA, colorB, t) {
  const a = new THREE.Color(colorA)
  const b = new THREE.Color(colorB)
  const c = a.clone().lerp(b, t)
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`
}

/* ------------------------------------------------------------------ *
 * Soil
 * ------------------------------------------------------------------ */

/**
 * Tilled soil: broad damp/dry patches, fine clod grain, and scattered small
 * stones. Deliberately desaturated — real soil is much greyer than the
 * chocolate brown people reach for by default.
 */
export function createSoilTextures(size = 512) {
  const clods = fbm(size, { scale: 26, octaves: 5, seed: 11 })
  const patches = fbm(size, { scale: 4, octaves: 3, seed: 29 })

  const colorCanvas = blankCanvas(size)
  const ctx = colorCanvas.getContext('2d')
  const image = ctx.createImageData(size, size)

  const dry = new THREE.Color('#8a7358')
  const damp = new THREE.Color('#5b4a38')
  const scratch = new THREE.Color('#6f5c46')

  for (let i = 0; i < size * size; i++) {
    // Large-scale moisture variation, then fine clod shading on top.
    const moisture = patches[i]
    const grain = clods[i]

    const base = damp.clone().lerp(dry, moisture * 0.75 + grain * 0.25)
    base.lerp(scratch, grain * 0.2)

    // Darken the pits between clods.
    const shade = 0.82 + grain * 0.3
    const j = i * 4
    image.data[j] = Math.min(255, base.r * 255 * shade)
    image.data[j + 1] = Math.min(255, base.g * 255 * shade)
    image.data[j + 2] = Math.min(255, base.b * 255 * shade)
    image.data[j + 3] = 255
  }

  ctx.putImageData(image, 0, 0)

  // Scattered grit and small stones.
  for (let n = 0; n < size * 1.6; n++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.6 + 0.4
    const light = Math.random()
    // Pale grit reads as small stones; dark specks read as damp clods.
    ctx.fillStyle =
      light > 0.72
        ? mix('#a0917d', '#8d8071', Math.random())
        : mix('#4b3d2e', '#3f3427', Math.random())
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Roughness: damp soil is smoother than dry crumbly soil, so reuse the
  // moisture field inverted.
  const roughCanvas = blankCanvas(size)
  const rctx = roughCanvas.getContext('2d')
  const rimg = rctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = 200 + clods[i] * 40 - patches[i] * 45
    const j = i * 4
    rimg.data[j] = rimg.data[j + 1] = rimg.data[j + 2] = Math.max(0, Math.min(255, v))
    rimg.data[j + 3] = 255
  }
  rctx.putImageData(rimg, 0, 0)

  return {
    map: toTexture(colorCanvas, { srgb: true }),
    normalMap: toTexture(normalMapFromHeight(clods, size, 2.6)),
    roughnessMap: toTexture(roughCanvas),
  }
}

/* ------------------------------------------------------------------ *
 * Grass ground
 * ------------------------------------------------------------------ */

/**
 * The turf that surrounds the field. Instanced blades sit on top of this, but
 * the texture carries the colour variation so sparse blades still read as a
 * continuous surface.
 */
export function createGrassTextures(size = 512) {
  const clumps = fbm(size, { scale: 18, octaves: 4, seed: 47 })
  const dryness = fbm(size, { scale: 5, octaves: 3, seed: 63 })

  const canvas = blankCanvas(size)
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)

  const lush = new THREE.Color('#5c6b3c')
  const parched = new THREE.Color('#87844f')
  const shadowed = new THREE.Color('#404c2c')

  for (let i = 0; i < size * size; i++) {
    const c = lush.clone().lerp(parched, dryness[i] * 0.7)
    c.lerp(shadowed, (1 - clumps[i]) * 0.45)

    const j = i * 4
    image.data[j] = c.r * 255
    image.data[j + 1] = c.g * 255
    image.data[j + 2] = c.b * 255
    image.data[j + 3] = 255
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: toTexture(canvas, { srgb: true }),
    normalMap: toTexture(normalMapFromHeight(clumps, size, 1.4)),
  }
}

/* ------------------------------------------------------------------ *
 * Pathways
 * ------------------------------------------------------------------ */

/**
 * Compacted dirt track: paler and smoother than the tilled soil, with wheel
 * ruts running along the length.
 */
export function createPathTextures(size = 512) {
  const grit = fbm(size, { scale: 30, octaves: 4, seed: 91 })
  const wear = fbm(size, { scale: 6, octaves: 3, seed: 17 })

  const canvas = blankCanvas(size)
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)

  const dust = new THREE.Color('#9c8d75')
  const packed = new THREE.Color('#7b6e5a')

  for (let i = 0; i < size * size; i++) {
    const c = packed.clone().lerp(dust, wear[i] * 0.8 + grit[i] * 0.2)
    const shade = 0.88 + grit[i] * 0.24
    const j = i * 4
    image.data[j] = Math.min(255, c.r * 255 * shade)
    image.data[j + 1] = Math.min(255, c.g * 255 * shade)
    image.data[j + 2] = Math.min(255, c.b * 255 * shade)
    image.data[j + 3] = 255
  }

  ctx.putImageData(image, 0, 0)

  // Two darker wheel ruts.
  ctx.globalAlpha = 0.28
  ctx.fillStyle = '#5f5344'
  ctx.fillRect(size * 0.24, 0, size * 0.1, size)
  ctx.fillRect(size * 0.66, 0, size * 0.1, size)
  ctx.globalAlpha = 1

  return {
    map: toTexture(canvas, { srgb: true }),
    normalMap: toTexture(normalMapFromHeight(grit, size, 1.1)),
  }
}
