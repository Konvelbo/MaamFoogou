import type { DesignElement } from '../types/configurator'
import type { NormalizedDesignElement } from '../services/maamfoogouStore'

/**
 * Convertit les éléments normalisés (0 à 1) de la base Convex/Maamfoogou
 * vers les coordonnées 3D du modèle de t-shirt (TShirtModel / SceneCanvas).
 */
export function normalizedTo3DElements(
  elements: Array<NormalizedDesignElement>
): Array<DesignElement> {
  return elements.map((el) => {
    const posX = Number(((el.x - 0.5) * 0.34).toFixed(4))
    const posY = Number(((0.5 - el.y) * 0.38).toFixed(4))
    const posZ = el.side === 'front' ? 0.14 : -0.12

    return {
      id: el.id,
      type: el.type,
      side: el.side,
      position: [posX, posY, posZ],
      rotation: (el.rotation * Math.PI) / 180,
      scale: Math.max(0.12, Math.min(0.28, Number((el.width * 0.36).toFixed(3)))),
      imageUrl: el.imageUrl,
      originalFileName: el.imageUrl ? 'motif.png' : undefined,
      aspectRatio:
        el.originalWidth && el.originalHeight
          ? el.originalWidth / el.originalHeight
          : 1,
      text: el.text || 'MAAMFOOGOU',
      fontFamily: el.font || 'Impact, Haettenschweiler, sans-serif',
      fontSize: el.fontSize ? Math.max(36, el.fontSize * 2) : 54,
      textColor: el.color || '#F5F2EB',
      strokeColor: '#111111',
      strokeWidth: 1,
    }
  })
}

/**
 * Convertit les éléments 3D manipulés sur le t-shirt (TShirtModel / ConfiguratorPanel)
 * vers le format normalisé (0 à 1) attendu par Convex (Section 7).
 */
export function threeDToNormalizedElements(
  elements: Array<DesignElement>
): Array<NormalizedDesignElement> {
  return elements.map((el) => {
    const normX = Math.max(
      0,
      Math.min(1, Number((el.position[0] / 0.34 + 0.5).toFixed(4)))
    )
    const normY = Math.max(
      0,
      Math.min(1, Number((0.5 - el.position[1] / 0.38).toFixed(4)))
    )
    const normW = Math.max(
      0.05,
      Math.min(1, Number((el.scale / 0.36).toFixed(4)))
    )
    const normH = Math.max(
      0.05,
      Math.min(
        1,
        Number(
          (
            normW / (el.aspectRatio && el.aspectRatio > 0 ? el.aspectRatio : 1.6)
          ).toFixed(4)
        )
      )
    )

    return {
      id: el.id,
      side: el.side,
      type: el.type,
      x: normX,
      y: normY,
      width: normW,
      height: normH,
      rotation: Math.round((el.rotation * 180) / Math.PI),
      text: el.text,
      font: el.fontFamily,
      fontSize: el.fontSize ? Math.round(el.fontSize / 2) : 26,
      color: el.textColor,
      imageUrl: el.imageUrl,
      originalWidth: el.imageResolution?.width,
      originalHeight: el.imageResolution?.height,
    }
  })
}
