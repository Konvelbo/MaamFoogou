import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, Save, ShoppingBag, Unlock } from 'lucide-react'
import { SceneCanvas } from '../canvas/SceneCanvas'
import { ConfiguratorPanel } from '../editor/ConfiguratorPanel'
import {
  type MaamfoogouDesign,
  saveNormalizedDesign,
} from '../../services/maamfoogouStore'
import {
  normalizedTo3DElements,
  threeDToNormalizedElements,
} from '../../utils/designElementMapper'
import { generateTShirtSvgUrl } from '../../utils/tshirtPreviewSvg'
import type { SceneCanvasHandle } from '../canvas/SceneCanvas'
import type {
  CustomizerSnapshot,
  DesignElement,
  TShirtSide,
  TShirtSize,
} from '../../types/configurator'

interface Design3DIntegrationPlaceholderProps {
  initialDesign?: MaamfoogouDesign | null
  onSavedDesign: (designId: string) => void
  onBuyDesignNow: (designId: string) => void
}

const DEFAULT_3D_ELEMENTS: Array<DesignElement> = [
  {
    id: 'init-front-txt',
    type: 'text',
    side: 'front',
    position: [0, 0.04, 0.14],
    rotation: 0,
    scale: 0.18,
    text: 'MAAMFOOGOU',
    fontFamily: 'Impact, Haettenschweiler, sans-serif',
    fontSize: 62,
    textColor: '#F4F4F0',
    strokeColor: '#CA8A04',
    strokeWidth: 2,
  },
]

function cloneSnapshot(snap: CustomizerSnapshot): CustomizerSnapshot {
  return {
    color: snap.color,
    size: snap.size,
    elements: snap.elements.map((el) => ({
      ...el,
      position: [...el.position] as [number, number, number],
    })),
  }
}

export const Design3DIntegrationPlaceholder: React.FC<
  Design3DIntegrationPlaceholderProps
> = ({ initialDesign, onSavedDesign, onBuyDesignNow }) => {
  const initialColor = initialDesign?.tshirtColor || '#18181B'
  const initialSize = (initialDesign?.size as TShirtSize) || 'L'
  const initialElements =
    initialDesign && initialDesign.elements.length > 0
      ? normalizedTo3DElements(initialDesign.elements)
      : DEFAULT_3D_ELEMENTS

  const [designName, setDesignName] = useState(
    initialDesign ? `${initialDesign.name} (Perso 3D)` : 'Création Studio 3D Faso'
  )
  const [color, setColor] = useState<string>(initialColor)
  const [size, setSize] = useState<TShirtSize>(initialSize)
  const [activeSide, setActiveSide] = useState<TShirtSide>('front')
  const [zoom, setZoom] = useState<number>(1.0)
  const [isModelFrozen, setIsModelFrozen] = useState<boolean>(false)
  const [elements, setElements] =
    useState<Array<DesignElement>>(initialElements)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    initialElements[0]?.id || null
  )
  const [rightsConfirmed, setRightsConfirmed] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Pile d'historique Annuler / Rétablir (Undo / Redo)
  const [history, setHistory] = useState<Array<CustomizerSnapshot>>([
    cloneSnapshot({
      color: initialColor,
      size: initialSize,
      elements: initialElements,
    }),
  ])
  const [historyIndex, setHistoryIndex] = useState<number>(0)

  const sceneRef = useRef<SceneCanvasHandle | null>(null)

  // Rechargement d'un design existant en entrée (Section 7)
  useEffect(() => {
    if (!initialDesign) return
    const nextColor = initialDesign.tshirtColor || '#18181B'
    const nextSize = (initialDesign.size as TShirtSize) || 'L'
    const nextEls =
      initialDesign.elements.length > 0
        ? normalizedTo3DElements(initialDesign.elements)
        : DEFAULT_3D_ELEMENTS

    setDesignName(`${initialDesign.name} (Perso 3D)`)
    setColor(nextColor)
    setSize(nextSize)
    setElements(nextEls)
    setSelectedElementId(nextEls[0]?.id || null)
    setHistory([
      cloneSnapshot({
        color: nextColor,
        size: nextSize,
        elements: nextEls,
      }),
    ])
    setHistoryIndex(0)
  }, [initialDesign])

  const pushSnapshot = useCallback(
    (nextSnap: CustomizerSnapshot) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1)
        return [...sliced, cloneSnapshot(nextSnap)]
      })
      setHistoryIndex((idx) => idx + 1)
    },
    [historyIndex]
  )

  const handleCommitHistory = useCallback(() => {
    pushSnapshot({ color, size, elements })
  }, [color, size, elements, pushSnapshot])

  const handleUndo = () => {
    if (historyIndex <= 0) return
    const targetIdx = historyIndex - 1
    const snap = cloneSnapshot(history[targetIdx])
    setColor(snap.color)
    setSize(snap.size)
    setElements(snap.elements)
    setHistoryIndex(targetIdx)
  }

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return
    const targetIdx = historyIndex + 1
    const snap = cloneSnapshot(history[targetIdx])
    setColor(snap.color)
    setSize(snap.size)
    setElements(snap.elements)
    setHistoryIndex(targetIdx)
  }

  const handleChangeColor = (nextHex: string) => {
    setColor(nextHex)
    pushSnapshot({ color: nextHex, size, elements })
  }

  const handleChangeSize = (nextSize: TShirtSize) => {
    setSize(nextSize)
    pushSnapshot({ color, size: nextSize, elements })
  }

  const handleAddElement = (newEl: DesignElement) => {
    const next = [...elements, newEl]
    setElements(next)
    setSelectedElementId(newEl.id)
    setActiveSide(newEl.side)
    pushSnapshot({ color, size, elements: next })
  }

  const handleUpdateElement = (id: string, patch: Partial<DesignElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...patch } : el))
    )
  }

  const handleDeleteElement = (id: string) => {
    const next = elements.filter((el) => el.id !== id)
    setElements(next)
    if (selectedElementId === id) {
      setSelectedElementId(null)
    }
    pushSnapshot({ color, size, elements: next })
  }

  /**
   * Capture les rendus 3D Devant/Dos du studio 3D, normalise les coordonnées (0..1)
   * et sauvegarde dans Convex/Maamfoogou (Mes collections ou Achat direct)
   */
  const handlePersist3DDesign = async (buyNow: boolean) => {
    const hasUploadedImages = elements.some((el) => el.type === 'image')
    if (hasUploadedImages && !rightsConfirmed) return

    setIsSaving(true)
    try {
      const captured = await sceneRef.current?.captureFrontAndBackPreviews()
      const frontText =
        elements.find((e) => e.side === 'front' && e.type === 'text')?.text ||
        designName
      const backText =
        elements.find((e) => e.side === 'back' && e.type === 'text')?.text ||
        'MAAMFOOGOU'

      const fallbackFront = generateTShirtSvgUrl({
        tshirtColor: color,
        view: 'front',
        headline: frontText.slice(0, 16),
      })
      const fallbackBack = generateTShirtSvgUrl({
        tshirtColor: color,
        view: 'back',
        headline: backText.slice(0, 16),
      })

      const normalizedElements = threeDToNormalizedElements(elements)

      const res = saveNormalizedDesign({
        designId: initialDesign?.id,
        name: designName,
        description:
          'Création réalisée dans le configurateur 3D temps réel Maamfoogou (coton peigné 220g/m²).',
        tshirtColor: color,
        size,
        status: 'published',
        price: initialDesign?.price || 12500,
        previewFrontUrl: captured?.frontDataUrl || fallbackFront,
        previewBackUrl: captured?.backDataUrl || fallbackBack,
        printFrontUrl: captured?.frontDataUrl || fallbackFront,
        printBackUrl: captured?.backDataUrl || fallbackBack,
        elements: normalizedElements,
      })

      if (res.success && res.designId) {
        if (buyNow) {
          onBuyDesignNow(res.designId)
        } else {
          onSavedDesign(res.designId)
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-6 space-y-5">
      {/* Barre supérieure du Studio 3D : Nom de la création + Sauvegarder dans Mes collections + Acheter */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#111111]">
            Studio 3D Temps Réel :
          </span>
          <input
            type="text"
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            placeholder="Nom de votre modèle 3D"
            className="h-9 px-3 text-xs border border-[#CCCCCC] rounded-[4px] text-[#111111] focus:outline-none focus:border-[#111111] min-w-[240px]"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handlePersist3DDesign(false)}
            className="h-9 px-4 border border-[#111111] bg-white hover:bg-[#F7F7F7] text-[#111111] text-xs font-medium rounded-[4px] flex items-center gap-2 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Sauvegarder dans Mes collections (+40 XP)</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handlePersist3DDesign(true)}
            className="h-9 px-4 bg-[#111111] hover:bg-[#333333] text-white text-xs font-medium rounded-[4px] flex items-center gap-2 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Commander ce t-shirt 3D</span>
          </button>
        </div>
      </div>

      {/* Grille Studio 3D : Scène 3D interactive à gauche (avec bouton Figer le modèle) + ConfiguratorPanel à droite */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Colonne Gauche : Scène 3D WebGL (TShirtModel + plis coton + decals) */}
        <div className="relative h-[460px] sm:h-[600px] lg:col-span-7 lg:h-[720px] [&>div]:!rounded-[6px]">
          <SceneCanvas
            ref={sceneRef}
            color={color}
            size={size}
            activeSide={activeSide}
            zoom={zoom}
            isFrozen={isModelFrozen}
            elements={elements}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onCommitHistory={handleCommitHistory}
          />

          {/* Bandeau supérieur dans la scène 3D + Bouton "Figer le modèle" */}
          <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 rounded-[4px] border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-md">
              <span
                className="h-3 w-3 rounded-[2px] border border-white/30"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold">
                Vue : {activeSide === 'front' ? 'Devant' : 'Dos'}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="font-bold text-amber-400">Taille {size}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsModelFrozen((prev) => !prev)}
              className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-[4px] border px-3.5 py-1.5 text-xs font-bold shadow-lg backdrop-blur-md transition-all ${
                isModelFrozen
                  ? 'border-amber-400 bg-amber-500 text-zinc-950'
                  : 'border-white/15 bg-zinc-900/85 text-zinc-200 hover:border-white/30 hover:text-white'
              }`}
            >
              {isModelFrozen ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Modèle figé (déverrouiller)
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 text-amber-400" />
                  Figer le modèle pour éditer
                </>
              )}
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[4px] border border-white/10 bg-zinc-900/75 px-3.5 py-1 text-[11px] text-zinc-300 backdrop-blur-md">
            {isModelFrozen
              ? 'Modèle verrouillé • Glissez directement vos textes et images sur le tissu'
              : 'Glissez un motif pour le déplacer sur le tissu • Pincez ou molette pour zoomer'}
          </div>
        </div>

        {/* Colonne Droite : Panneau complet d'édition 3D (ConfiguratorPanel) */}
        <div className="lg:col-span-5 lg:h-[720px] [&>div]:!rounded-[6px]">
          <ConfiguratorPanel
            color={color}
            size={size}
            activeSide={activeSide}
            zoom={zoom}
            isFrozen={isModelFrozen}
            elements={elements}
            selectedElementId={selectedElementId}
            rightsConfirmed={rightsConfirmed}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            isAddingToCart={isSaving}
            onChangeColor={handleChangeColor}
            onChangeSize={handleChangeSize}
            onChangeSide={setActiveSide}
            onChangeZoom={setZoom}
            onToggleFrozen={() => setIsModelFrozen((prev) => !prev)}
            onAddElement={handleAddElement}
            onSelectElement={setSelectedElementId}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onCommitHistory={handleCommitHistory}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onChangeRightsConfirmed={setRightsConfirmed}
            onAddToCart={() => handlePersist3DDesign(true)}
          />
        </div>
      </div>
    </div>
  )
}
