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
    // Coordonnées centrées sur le buste (si x est proche de 0.5, posX = 0)
    const rawX = typeof el.x === 'number' ? el.x : 0.5
    const rawY = typeof el.y === 'number' ? el.y : 0.39
    const posX = Number(
      (Math.abs(rawX - 0.5) < 0.04 ? 0 : (rawX - 0.5) * 0.24).toFixed(4)
    )
    const posY = Number(((0.56 - rawY) * 0.42).toFixed(4))
    const posZ = el.side === 'front' ? 0.14 : -0.12

    return {
      id: el.id,
      type: el.type,
      side: el.side,
      position: [posX, posY, posZ],
      rotation: ((el.rotation || 0) * Math.PI) / 180,
      // Échelle dynamique sur le torse et le dos permettant d'atteindre la taille maximale demandée
      scale: Math.max(
        0.10,
        Math.min(0.48, Number(((el.width || 0.44) * 0.45).toFixed(3)))
      ),
      imageUrl: el.imageUrl,
      originalFileName: el.imageUrl ? 'motif.png' : undefined,
      aspectRatio:
        el.originalWidth && el.originalHeight
          ? el.originalWidth / el.originalHeight
          : 1,
      text: el.text || 'MAAMFOOGOU',
      fontFamily: el.font || '"Montserrat", sans-serif',
      fontSize: el.fontSize ? Math.min(68, Math.max(32, el.fontSize)) : 52,
      textColor: el.color || '#F5F2EB',
      strokeColor: '#111111',
      strokeWidth: 0,
      locked: Boolean(el.locked),
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
      Math.min(1, Number((el.position[0] / 0.24 + 0.5).toFixed(4)))
    )
    const normY = Math.max(
      0,
      Math.min(1, Number((0.56 - el.position[1] / 0.42).toFixed(4)))
    )
    const normW = Math.max(
      0.05,
      Math.min(1, Number((el.scale / 0.45).toFixed(4)))
    )
    const normH = Math.max(
      0.05,
      Math.min(
        1,
        Number(
          (
            normW / (el.aspectRatio && el.aspectRatio > 0 ? el.aspectRatio : 2.0)
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
      fontSize: el.fontSize ? Math.round(el.fontSize) : 52,
      color: el.textColor,
      imageUrl: el.imageUrl,
      originalWidth: el.imageResolution?.width,
      originalHeight: el.imageResolution?.height,
      locked: Boolean(el.locked),
    }
  })
}

