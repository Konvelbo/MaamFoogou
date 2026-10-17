import * as THREE from 'three'
import type { DesignElement } from '../types/configurator'

// Cache des textures de tissu pour éviter de les régénérer
let cachedNormalMap: THREE.CanvasTexture | null = null
let cachedRoughnessMap: THREE.CanvasTexture | null = null
let cachedBumpMap: THREE.CanvasTexture | null = null

/**
 * Génère une normal map procédurale combinant :
 * 1. Le micro-tissage croisé des fibres de coton peigné
 * 2. Des plis organiques subtils pour renforcer le réalisme sous l'éclairage HDRI
 */
export function getCottonNormalMap(): THREE.CanvasTexture {
  if (cachedNormalMap) return cachedNormalMap

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4

      // Trame et chaîne du fil de coton (effet tissé croisé)
      const warp = Math.sin((x / size) * Math.PI * 64) * 14
      const weft = Math.cos((y / size) * Math.PI * 64) * 14

      // Ondulations secondaires simulant le grain naturel du jersey de coton
      const grainX = Math.sin((x / size) * Math.PI * 16 + (y / size) * 4) * 6
      const grainY = Math.cos((y / size) * Math.PI * 16 - (x / size) * 4) * 6

      // Normal map : R = X (128 neutre), G = Y (128 neutre), B = Z (255 vers l'extérieur)
      data[idx] = Math.min(255, Math.max(0, 128 + warp + grainX))
      data[idx + 1] = Math.min(255, Math.max(0, 128 + weft + grainY))
      data[idx + 2] = 245
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(18, 18)
  texture.needsUpdate = true

  cachedNormalMap = texture
  return texture
}

/**
 * Génère une carte de rugosité (roughness map) élevée adaptée au coton mat
 */
export function getCottonRoughnessMap(): THREE.CanvasTexture {
  if (cachedRoughnessMap) return cachedRoughnessMap

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      // Valeur élevée (entre 215 et 240 sur 255, soit roughness ~0.85 à 0.94)
      const weave =
        Math.sin(x * 0.8) * Math.cos(y * 0.8) * 10 +
        ((x * 13 + y * 37) % 9)
      const val = Math.min(250, Math.max(210, Math.floor(228 + weave)))
      data[idx] = val
      data[idx + 1] = val
      data[idx + 2] = val
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(24, 24)
  texture.needsUpdate = true

  cachedRoughnessMap = texture
  return texture
}

/**
 * Génère une texture de micro-relief (bump/ao) du tissu tissé
 */
export function getCottonWeaveTexture(): THREE.CanvasTexture {
  if (cachedBumpMap) return cachedBumpMap

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f8f8f8'
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#e6e6e6'
  for (let y = 0; y < size; y += 2) {
    for (let x = (y / 2) % 2; x < size; x += 2) {
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(32, 32)
  texture.needsUpdate = true

  cachedBumpMap = texture
  return texture
}

/**
 * Convertit un élément de type 'text' en une texture Canvas 2D haute résolution
 * afin de le plaquer en Decal sur les plis 3D du t-shirt.
 * Calibre automatiquement la taille de police pour garantir qu'aucun texte ne soit jamais coupé.
 */
export function createTextDecalTexture(element: DesignElement): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const text = element.text?.trim() || 'VOTRE TEXTE'
  const fontFamily = element.fontFamily || '"Plus Jakarta Sans", system-ui, sans-serif'
  const requestedFontSize = Math.min(84, Math.max(24, element.fontSize || 52)) * 1.85
  const textColor = element.textColor || '#FFFFFF'
  const strokeColor = element.strokeColor || '#000000'
  const strokeWidth = (element.strokeWidth || 0) * 1.8

  const lines = text.split('\n')
  const safeMaxWidth = canvas.width * 0.80 - strokeWidth * 4
  const safeMaxHeight = canvas.height * 0.78 - strokeWidth * 4

  // Calibrage automatique pour éviter toute coupure horizontale ou verticale
  let fittedFontSize = requestedFontSize
  ctx.font = `700 ${fittedFontSize}px ${fontFamily}`

  let maxMeasuredWidth = 0
  for (const line of lines) {
    const w = ctx.measureText(line).width
    if (w > maxMeasuredWidth) maxMeasuredWidth = w
  }

  if (maxMeasuredWidth > safeMaxWidth && maxMeasuredWidth > 0) {
    fittedFontSize = Math.floor(fittedFontSize * (safeMaxWidth / maxMeasuredWidth))
  }

  const estTotalHeight = lines.length * fittedFontSize * 1.2
  if (estTotalHeight > safeMaxHeight && estTotalHeight > 0) {
    fittedFontSize = Math.floor(fittedFontSize * (safeMaxHeight / estTotalHeight))
  }

  fittedFontSize = Math.max(24, fittedFontSize)
  ctx.font = `700 ${fittedFontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const lineHeight = fittedFontSize * 1.18
  const totalHeight = lines.length * lineHeight
  const startY = (canvas.height - totalHeight) / 2 + lineHeight / 2

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight
    if (strokeWidth > 0) {
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.lineWidth = strokeWidth * 2
      ctx.strokeStyle = strokeColor
      ctx.strokeText(line, canvas.width / 2, y)
    }
    ctx.fillStyle = textColor
    ctx.fillText(line, canvas.width / 2, y)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

