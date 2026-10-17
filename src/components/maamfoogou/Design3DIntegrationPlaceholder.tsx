import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  FlipHorizontal,
  Lock,
  Save,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Unlock,
} from 'lucide-react'
import { SceneCanvas } from '../canvas/SceneCanvas'
import { ConfiguratorPanel } from '../editor/ConfiguratorPanel'
import {
  type MaamfoogouDesign,
  saveNormalizedDesign,
  useMaamfoogouStore,
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
    scale: 0.17,
    text: 'MAAMFOOGOU',
    fontFamily: '"Montserrat", sans-serif',
    fontSize: 48,
    textColor: '#F4F4F0',
    strokeColor: '#111111',
    strokeWidth: 0,
    locked: false,
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
  const state = useMaamfoogouStore()
  const currentUser = state.users.find((u) => u.id === state.currentUserId)
  const isOwner = Boolean(
    initialDesign && currentUser && initialDesign.ownerId === currentUser.id
  )
  const isRemix = Boolean(initialDesign && !isOwner)

  const initialColor = initialDesign?.tshirtColor || '#18181B'
  const initialSize = (initialDesign?.size as TShirtSize) || 'L'
  const initialElements =
    initialDesign && initialDesign.elements.length > 0
      ? normalizedTo3DElements(initialDesign.elements)
      : DEFAULT_3D_ELEMENTS

  const [designName, setDesignName] = useState(
    initialDesign
      ? isRemix
        ? `${initialDesign.name} (Remix)`
        : `${initialDesign.name} (Perso 3D)`
      : 'Création Studio 3D Faso'
  )
  const [allowRemix, setAllowRemix] = useState<boolean>(
    initialDesign?.allowRemix !== undefined ? initialDesign.allowRemix : false
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
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return
    const touchEndY = e.changedTouches[0].clientY
    const deltaY = touchEndY - touchStartY
    if (deltaY < -35 && !isDrawerOpen) {
      setIsDrawerOpen(true)
    } else if (deltaY > 35 && isDrawerOpen) {
      setIsDrawerOpen(false)
    }
    setTouchStartY(null)
  }

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

    const nextAllowRemix =
      initialDesign.allowRemix !== undefined ? initialDesign.allowRemix : false
    setAllowRemix(nextAllowRemix)
    if (isRemix) {
      setDesignName(`${initialDesign.name} (Remix)`)
    } else {
      setDesignName(`${initialDesign.name} (Perso 3D)`)
    }
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
        designId: isRemix ? undefined : initialDesign?.id,
        isRemix,
        parentDesignId: isRemix ? initialDesign?.id : initialDesign?.parentDesignId,
        parentDesignName: isRemix ? initialDesign?.name : initialDesign?.parentDesignName,
        parentCreatorName: isRemix ? initialDesign?.creatorName : initialDesign?.parentCreatorName,
        allowRemix,
        name: designName,
        description: isRemix
          ? `Remix personnalisé basé sur « ${initialDesign?.name} » par ${initialDesign?.creatorName}.`
          : 'Création réalisée dans le configurateur 3D temps réel Maamfoogou (coton peigné 220g/m²).',
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
    <div className="max-w-[1360px] mx-auto px-0 sm:px-8 py-0 sm:py-5 lg:space-y-4 relative">
      {/* Alerte mode Remix 3D : sur Desktop */}
      {isRemix && initialDesign && (
        <div className="hidden lg:flex bg-[#FAFAFA] border border-[#111111] p-3 text-xs flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-none">
          <div className="flex items-center gap-2">
            <span className="bg-[#111111] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Mode Remix 3D
            </span>
            <span className="font-semibold text-[#111111]">
              Basé sur « {initialDesign.name} » par {initialDesign.creatorName}
            </span>
          </div>
          <span className="text-[#666666] text-[11px]">
            Vos modifications créeront une nouvelle copie dans votre collection sans altérer le modèle de base.
          </span>
        </div>
      )}

      {/* Barre supérieure du Studio 3D (Desktop uniquement) */}
      <div className="hidden lg:flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#111111]">
              Studio 3D :
            </span>
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Nom de votre modèle 3D"
              className="h-9 px-3 text-xs border border-[#CCCCCC] rounded-none text-[#111111] focus:outline-none focus:border-[#111111] sm:min-w-[240px]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#111111] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowRemix}
              onChange={(e) => setAllowRemix(e.target.checked)}
              className="w-4 h-4 rounded-none accent-[#111111]"
            />
            <span className="font-medium text-[11px]">
              Autoriser la personnalisation publique (copie / remix)
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handlePersist3DDesign(false)}
            className="h-9 px-3.5 border border-[#111111] bg-white hover:bg-[#F5F5F5] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Sauvegarder (+40 XP)</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handlePersist3DDesign(true)}
            className="h-9 px-3.5 bg-[#111111] hover:bg-[#2A2A2A] text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-1.5 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Acheter ce modèle</span>
          </button>
        </div>
      </div>

      {/* Backdrop semi-transparent sur mobile quand le Drawer Bottom est ouvert */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-[2px] transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Grille Studio 3D : Scène 3D pleine page sur mobile + Panneau d'édition dans le Drawer Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-5 items-start">
        {/* Colonne Gauche / Pleine page Mobile : Scène 3D WebGL (TShirtModel + plis coton + decals) */}
        <div className="relative w-full h-[calc(100dvh-104px)] min-h-[520px] lg:col-span-7 lg:h-[680px] bg-[#EAEAEA] overflow-hidden">
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

          {/* Badge mode Remix flottant sur mobile */}
          {isRemix && initialDesign && (
            <div className="lg:hidden absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-[#111111] text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-white/20 shadow-xs">
              <Sparkles className="w-2.5 h-2.5 text-[#E05A2B]" />
              <span className="truncate max-w-[180px]">Remix: {initialDesign.name}</span>
            </div>
          )}

          {/* Bandeau supérieur flottant dans la scène 3D */}
          <div
            className={`pointer-events-none absolute left-3 right-3 ${
              isRemix && initialDesign ? 'top-9 sm:top-3' : 'top-3'
            } flex flex-wrap items-center justify-between gap-2 z-10`}
          >
            <div className="flex items-center gap-2 border border-[#CCCCCC] bg-white/95 px-2.5 py-1 text-[11px] text-[#111111] shadow-xs">
              <span
                className="h-3 w-3 border border-[#CCCCCC]"
                style={{ backgroundColor: color }}
              />
              <span className="font-bold uppercase tracking-wider">
                {activeSide === 'front' ? 'Face' : 'Dos'}
              </span>
              <span className="text-[#999999]">•</span>
              <span className="font-medium text-[#666666]">
                Taille {size}
              </span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              {/* Bouton rapide bascule Devant / Dos */}
              <button
                type="button"
                onClick={() =>
                  setActiveSide((prev) => (prev === 'front' ? 'back' : 'front'))
                }
                title="Tourner le t-shirt pour voir l'autre côté"
                className="inline-flex items-center gap-1 border border-[#111111] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#111111] hover:bg-[#F5F5F5] transition-colors shadow-xs"
              >
                <FlipHorizontal className="h-3 w-3" />
                <span>{activeSide === 'front' ? 'Voir Dos' : 'Voir Face'}</span>
              </button>

              {/* Bouton Figer / Libérer */}
              <button
                type="button"
                onClick={() => setIsModelFrozen((prev) => !prev)}
                className={`pointer-events-auto inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors shadow-xs ${
                  isModelFrozen
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : 'border-[#CCCCCC] bg-white/95 text-[#111111] hover:border-[#111111]'
                }`}
              >
                {isModelFrozen ? (
                  <>
                    <Lock className="h-3 w-3" />
                    <span>Figé</span>
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3" />
                    <span>Figer</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Indication d'interaction en bas de la scène 3D (au-dessus du drawer en mode mobile) */}
          <div className="pointer-events-none absolute bottom-20 lg:bottom-3 left-1/2 -translate-x-1/2 max-w-[92%] truncate border border-[#CCCCCC] bg-white/95 px-3 py-1 text-[10px] uppercase tracking-wider text-[#666666] z-10 shadow-xs">
            {isModelFrozen
              ? 'Caméra figée • Déplacez vos éléments sur le buste'
              : 'Glissez un élément non verrouillé pour le positionner'}
          </div>
        </div>

        {/* Panneau d'édition : Drawer Bottom sur Mobile, Colonne droite sur Desktop */}
        <div
          className={`fixed inset-x-0 bottom-0 z-50 bg-white border-t-2 border-[#111111] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out flex flex-col lg:static lg:z-auto lg:border-t-0 lg:shadow-none lg:translate-y-0 lg:max-h-none lg:overflow-visible lg:bg-transparent lg:col-span-5 ${
            isDrawerOpen
              ? 'translate-y-0 max-h-[82dvh]'
              : 'translate-y-[calc(100%-66px)] max-h-[66px] overflow-hidden'
          }`}
        >
          {/* Poignée tactile de glissement (Mobile uniquement) */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            className="lg:hidden w-full pt-2 pb-1 cursor-pointer select-none flex flex-col items-center shrink-0 bg-white"
          >
            <div className="w-12 h-1 bg-[#CCCCCC] rounded-full" />
          </div>

          {/* PEEK BAR MOBILE (Visible uniquement quand le drawer est fermé) */}
          <div
            onClick={() => setIsDrawerOpen(true)}
            className={`lg:hidden flex items-center justify-between px-4 pb-2.5 pt-0.5 cursor-pointer select-none shrink-0 ${
              isDrawerOpen ? 'hidden' : 'flex'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 border border-[#CCCCCC] shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex flex-col">
                <div className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Personnaliser</span>
                  <ChevronUp className="w-3.5 h-3.5 text-[#111111]" />
                </div>
                <span className="text-[10px] text-[#757575] leading-none">
                  Couleurs • Tailles • Typo • Images
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePersist3DDesign(false)
                }}
                className="h-8 px-2.5 border border-[#111111] bg-white text-[#111111] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 rounded-none"
              >
                <Save className="w-3 h-3" />
                <span>+40 XP</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePersist3DDesign(true)
                }}
                className="h-8 px-3 bg-[#111111] text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 rounded-none"
              >
                <ShoppingBag className="w-3 h-3" />
                <span>Acheter</span>
              </button>
            </div>
          </div>

          {/* HEADER DU DRAWER OUVERT (Mobile uniquement) */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`lg:hidden flex items-center justify-between px-4 py-2 border-b border-[#E5E5E5] bg-[#FAFAFA] shrink-0 ${
              isDrawerOpen ? 'flex' : 'hidden'
            }`}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#111111]" />
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#111111]">
                Outils de modification 3D
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 border border-[#CCCCCC] bg-white text-[#111111] hover:border-[#111111] rounded-none"
            >
              <span>Voir 3D</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CONTENU DU PANNEAU (Scrollable dans le drawer sur mobile, fluide sur desktop) */}
          <div className="flex-1 overflow-y-auto px-4 py-3 lg:p-0">
            {/* Options mobiles supplémentaires : Nom du modèle & autorisation Remix */}
            <div className="lg:hidden space-y-2 border-b border-[#E5E5E5] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#111111] shrink-0">
                  Nom :
                </span>
                <input
                  type="text"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="Nom de votre modèle 3D"
                  className="h-8 px-2.5 text-xs border border-[#CCCCCC] rounded-none w-full text-[#111111] focus:outline-none focus:border-[#111111]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#111111] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowRemix}
                  onChange={(e) => setAllowRemix(e.target.checked)}
                  className="w-4 h-4 rounded-none accent-[#111111]"
                />
                <span className="font-medium text-[11px]">
                  Autoriser la personnalisation publique (remix)
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handlePersist3DDesign(false)}
                  className="h-8.5 border border-[#111111] bg-white text-[#111111] text-[11px] font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3 h-3" />
                  <span>Sauvegarder (+40 XP)</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handlePersist3DDesign(true)}
                  className="h-8.5 bg-[#111111] text-white text-[11px] font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Acheter ce modèle</span>
                </button>
              </div>
            </div>

            {/* ConfiguratorPanel complet */}
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
    </div>
  )
}

