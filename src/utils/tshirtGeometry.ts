import * as THREE from 'three'

let cachedGeometry: THREE.BufferGeometry | null = null

/**
 * Génère une géométrie 3D unifiée de t-shirt réaliste avec :
 * - Silhouette anatomique (torse, épaules tombantes, manches courtes, col rond côtelé, ourlet)
 * - Plis sculptés dans le maillage (drapé pectoral, plis de tension sous les bras, ondulations au bas)
 * - Maillage continu compatible avec la projection de Decal 3D (devant et dos)
 */
export function createRealisticTShirtGeometry(): THREE.BufferGeometry {
  if (cachedGeometry) return cachedGeometry

  // Grille tubulaire haute densité pour sculpter le torse, les manches et les plis
  const radialSegments = 128
  const heightSegments = 96
  const totalHeight = 0.92 // De -0.46 (ourlet bas) à +0.46 (haut du col)

  const geometry = new THREE.CylinderGeometry(
    0.28,
    0.28,
    totalHeight,
    radialSegments,
    heightSegments,
    false
  )

  const posAttr = geometry.attributes.position
  const uvAttr = geometry.attributes.uv
  const vertex = new THREE.Vector3()

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i)

    // vNorm : 0 en bas de l'ourlet, 1 tout en haut du col
    const vNorm = (vertex.y + totalHeight / 2) / totalHeight
    const angle = Math.atan2(vertex.x, vertex.z) // 0 = devant (+Z), PI = dos (-Z), +-PI/2 = côtés (+-X)
    const absSin = Math.abs(Math.sin(angle)) // 1 sur les côtés/manches, 0 au centre poitrine/dos
    const cosAngle = Math.cos(angle) // +1 devant, -1 dos

    // 1. Profil de largeur (X) : torse + extension des manches entre vNorm = 0.56 et 0.90
    let halfWidth = 0.275
    // Légère coupe cintrée au milieu du buste, évasée aux épaules
    halfWidth += 0.015 * Math.sin(vNorm * Math.PI)

    // Extension latérale pour former les manches courtes réalistes
    let sleeveFactor = 0
    if (vNorm > 0.54 && vNorm < 0.92) {
      const sleeveT = (vNorm - 0.54) / (0.92 - 0.54)
      // Profil de manche avec chute d'épaule naturelle
      sleeveFactor = Math.sin(sleeveT * Math.PI)
      halfWidth += 0.22 * Math.pow(sleeveFactor, 0.75) * Math.pow(absSin, 1.35)
    }

    // Rétrécissement de l'encolure tout en haut (vNorm > 0.88)
    if (vNorm > 0.88) {
      const neckT = (vNorm - 0.88) / 0.12
      const collarRadius = THREE.MathUtils.lerp(halfWidth, 0.115, Math.pow(neckT, 0.85))
      halfWidth = collarRadius
    }

    // 2. Profil d'épaisseur avant/arrière (Z) : galbe thoracique et dorsal
    let halfDepth = 0.148
    // Galbe poitrine (légèrement plus bombé sur le haut du buste)
    const chestCurve = Math.sin(Math.min(1, vNorm * 1.15) * Math.PI) * 0.028
    halfDepth += chestCurve

    if (vNorm > 0.88) {
      const neckT = (vNorm - 0.88) / 0.12
      halfDepth = THREE.MathUtils.lerp(halfDepth, 0.085, Math.pow(neckT, 0.85))
    }

    // Application de la section elliptique anatomique
    let x = Math.sin(angle) * halfWidth
    let z = Math.cos(angle) * halfDepth
    let y = vertex.y

    // Inclinaison tombante des manches vers l'extérieur
    if (sleeveFactor > 0 && absSin > 0.55) {
      const armOut = (absSin - 0.55) / 0.45
      y -= armOut * sleeveFactor * 0.065
    }

    // Décolleté du col rond plus bas devant que derrière
    if (vNorm > 0.84) {
      const collarDropFront = Math.max(0, cosAngle) * 0.048 * ((vNorm - 0.84) / 0.16)
      const collarDropBack = Math.max(0, -cosAngle) * 0.015 * ((vNorm - 0.84) / 0.16)
      y -= collarDropFront + collarDropBack
    }

    // Bourrelet du col côtelé (ribbed collar)
    if (vNorm > 0.93) {
      const rib = Math.sin(((vNorm - 0.93) / 0.07) * Math.PI) * 0.008
      x += Math.sin(angle) * rib
      z += Math.cos(angle) * rib
    }

    // 3. Sculpture des plis réalistes du tissu (drapé naturel)
    // Plis diagonaux partant des aisselles vers le centre du buste
    const diagonalFold1 =
      Math.sin(x * 18 + y * 14 + 0.7) *
      Math.exp(-Math.pow(x * 2.2, 2)) *
      0.0045 *
      (1 - Math.abs(vNorm - 0.45))

    const diagonalFold2 =
      Math.cos(x * 22 - y * 16 - 0.4) *
      Math.exp(-Math.pow(x * 2.0, 2)) *
      0.0038 *
      (1 - Math.abs(vNorm - 0.55))

    // Plis verticaux de drapé vers l'ourlet inférieur
    const hemDrape =
      Math.sin(angle * 7 + y * 6) *
      Math.max(0, 1 - vNorm * 1.4) *
      0.0052

    // Plis de tension sous les manches / emmanchures
    const armpitCrease =
      sleeveFactor *
      Math.sin((vNorm - 0.54) * 38) *
      Math.pow(absSin, 2) *
      0.0045

    const totalFoldOffset = diagonalFold1 + diagonalFold2 + hemDrape + armpitCrease
    z += Math.sign(z || 1) * totalFoldOffset
    x += Math.sin(angle) * (hemDrape * 0.5)

    // Ourlet cousu en bas (vNorm < 0.04)
    if (vNorm < 0.04) {
      const hemLip = Math.sin((vNorm / 0.04) * Math.PI) * 0.004
      z += Math.cos(angle) * hemLip
      x += Math.sin(angle) * hemLip
    }

    posAttr.setXYZ(i, x, y, z)

    // Recalcul propre des coordonnées UV pour le placage de la texture de coton tissé
    uvAttr.setXY(i, (angle + Math.PI) / (2 * Math.PI), vNorm)
  }

  geometry.computeVertexNormals()
  cachedGeometry = geometry
  return geometry
}
