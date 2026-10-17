import React, { useRef, useState } from 'react'
import {
  Check,
  FlipHorizontal,
  ImagePlus,
  Lock,
  Move,
  Redo2,
  RotateCw,
  ShoppingBag,
  Trash2,
  Type,
  Undo2,
  Unlock,
  ZoomIn,
} from 'lucide-react'
import {
  ACCEPTED_IMAGE_TYPES,
  AVAILABLE_FONTS,
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_MIN_HEIGHT,
  IMAGE_MIN_WIDTH,
  TEXT_COLOR_PALETTE,
  TSHIRT_COLOR_PALETTE,
  TSHIRT_SIZES,
} from '../../config/constants'
import type {
  DesignElement,
  TShirtSide,
  TShirtSize,
} from '../../types/configurator'

interface ConfiguratorPanelProps {
  color: string
  size: TShirtSize
  activeSide: TShirtSide
  zoom: number
  isFrozen: boolean
  elements: Array<DesignElement>
  selectedElementId: string | null
  rightsConfirmed: boolean
  canUndo: boolean
  canRedo: boolean
  isAddingToCart: boolean
  onChangeColor: (hex: string) => void
  onChangeSize: (size: TShirtSize) => void
  onChangeSide: (side: TShirtSide) => void
  onChangeZoom: (zoom: number) => void
  onToggleFrozen: () => void
  onAddElement: (element: DesignElement) => void
  onSelectElement: (id: string | null) => void
  onUpdateElement: (id: string, patch: Partial<DesignElement>) => void
  onDeleteElement: (id: string) => void
  onCommitHistory: () => void
  onUndo: () => void
  onRedo: () => void
  onChangeRightsConfirmed: (confirmed: boolean) => void
  onAddToCart: () => void
}

export function ConfiguratorPanel({
  color,
  size,
  activeSide,
  zoom,
  isFrozen,
  elements,
  selectedElementId,
  rightsConfirmed,
  canUndo,
  canRedo,
  isAddingToCart,
  onChangeColor,
  onChangeSize,
  onChangeSide,
  onChangeZoom,
  onToggleFrozen,
  onAddElement,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onCommitHistory,
  onUndo,
  onRedo,
  onChangeRightsConfirmed,
  onAddToCart,
}: ConfiguratorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'style' | 'image' | 'text'>('style')

  // État pour la création d'un nouveau texte
  const [newText, setNewText] = useState('MAAMFOOGOU')
  const [newFont, setNewFont] = useState<string>(AVAILABLE_FONTS[0].value)
  const [newTextColor, setNewTextColor] = useState('#FFFFFF')
  const [newFontSize, setNewFontSize] = useState(50)
  const [newStrokeColor, setNewStrokeColor] = useState('#111111')
  const [newStrokeWidth, setNewStrokeWidth] = useState(0)

  const selectedElement =
    elements.find((el) => el.id === selectedElementId) || null
  const isSelectedLocked = Boolean(selectedElement?.locked)
  const sideElements = elements.filter((el) => el.side === activeSide)
  const hasUploadedImages = elements.some((el) => el.type === 'image')

  const activeColorLabel =
    TSHIRT_COLOR_PALETTE.find(
      (c) => c.hex.toLowerCase() === color.toLowerCase()
    )?.name || color.toUpperCase()

  /**
   * Validation stricte et import d'une image (PNG/JPG, <= 5 Mo, résolution >= 500x500 px)
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError(
        'Format non supporté. Veuillez importer un fichier PNG ou JPG.'
      )
      e.target.value = ''
      return
    }

    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
      setUploadError(
        `Le fichier fait ${sizeMb} Mo. La taille maximale autorisée est de 5 Mo.`
      )
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const img = new Image()
      img.onload = () => {
        if (img.width < IMAGE_MIN_WIDTH || img.height < IMAGE_MIN_HEIGHT) {
          setUploadError(
            `Résolution insuffisante (${img.width}×${img.height} px). Minimum requis : ${IMAGE_MIN_WIDTH}×${IMAGE_MIN_HEIGHT} px.`
          )
          return
        }

        const newElement: DesignElement = {
          id: `img-${Date.now()}`,
          type: 'image',
          side: activeSide,
          position: [0, 0.04, activeSide === 'front' ? 0.14 : -0.12],
          rotation: 0,
          scale: 0.16,
          imageUrl: dataUrl,
          originalFileName: file.name,
          originalFile: file,
          aspectRatio: img.width / img.height,
          imageResolution: { width: img.width, height: img.height },
          locked: false,
        }

        onAddElement(newElement)
        setUploadError(null)
      }
      img.onerror = () => {
        setUploadError("Impossible de décoder l'image sélectionnée.")
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  /**
   * Ajoute un nouvel élément Texte plaqué sur la face active (Devant ou Dos)
   */
  const handleAddTextElement = () => {
    if (!newText.trim()) return
    const textEl: DesignElement = {
      id: `txt-${Date.now()}`,
      type: 'text',
      side: activeSide,
      position: [0, 0.04, activeSide === 'front' ? 0.14 : -0.12],
      rotation: 0,
      scale: 0.17,
      text: newText.trim(),
      fontFamily: newFont,
      fontSize: newFontSize,
      textColor: newTextColor,
      strokeColor: newStrokeColor,
      strokeWidth: newStrokeWidth,
      locked: false,
    }
    onAddElement(textEl)
  }

  return (
    <div className="flex flex-col gap-4 rounded-none border border-[#E5E5E5] bg-white p-4 text-[#111111] sm:p-5">
      {/* Barre supérieure sobre : Bascule Devant/Dos, Figer le modèle, Annuler/Rétablir et Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5E5] pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex border border-[#CCCCCC] bg-[#F5F5F5]">
            <button
              type="button"
              onClick={() => onChangeSide('front')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeSide === 'front'
                  ? 'bg-[#111111] text-white'
                  : 'text-[#666666] hover:text-[#111111]'
              }`}
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
              Devant
            </button>
            <button
              type="button"
              onClick={() => onChangeSide('back')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeSide === 'back'
                  ? 'bg-[#111111] text-white'
                  : 'text-[#666666] hover:text-[#111111]'
              }`}
            >
              <FlipHorizontal className="h-3.5 w-3.5 scale-x-[-1]" />
              Dos
            </button>
          </div>

          {/* Bouton pour figer/libérer la caméra du modèle 3D */}
          <button
            type="button"
            onClick={onToggleFrozen}
            title="Figer le t-shirt et verrouiller la rotation caméra pour placer facilement vos éléments"
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              isFrozen
                ? 'border-[#111111] bg-[#111111] text-white'
                : 'border-[#CCCCCC] bg-white text-[#111111] hover:border-[#111111]'
            }`}
          >
            {isFrozen ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Modèle figé</span>
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" />
                <span>Figer le modèle</span>
              </>
            )}
          </button>
        </div>

        {/* Boutons Annuler / Rétablir + Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Annuler (Undo)"
            className="border border-[#CCCCCC] bg-white p-1.5 text-[#111111] transition hover:border-[#111111] disabled:opacity-30"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Rétablir (Redo)"
            className="border border-[#CCCCCC] bg-white p-1.5 text-[#111111] transition hover:border-[#111111] disabled:opacity-30"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 border border-[#CCCCCC] bg-[#F5F5F5] px-2 py-1">
            <ZoomIn className="h-3.5 w-3.5 text-[#666666]" />
            <input
              type="range"
              min={0.8}
              max={1.45}
              step={0.05}
              value={zoom}
              onChange={(e) => onChangeZoom(Number(e.target.value))}
              className="h-1.5 w-16 accent-[#111111]"
              aria-label="Niveau de zoom 3D"
            />
          </div>
        </div>
      </div>

      {/* Navigation par onglets de personnalisation (style sobre BZB) */}
      <div className="grid grid-cols-3 border-b border-[#E5E5E5]">
        <button
          type="button"
          onClick={() => setActiveTab('style')}
          className={`py-2.5 text-xs uppercase tracking-wider transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'style'
              ? 'border-[#111111] text-[#111111] font-bold'
              : 'border-transparent text-[#666666] hover:text-[#111111]'
          }`}
        >
          1. Tissu & Taille
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs uppercase tracking-wider transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'text'
              ? 'border-[#111111] text-[#111111] font-bold'
              : 'border-transparent text-[#666666] hover:text-[#111111]'
          }`}
        >
          <Type className="h-3.5 w-3.5" />
          2. Typographie
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('image')}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs uppercase tracking-wider transition-colors border-b-2 -mb-[1px] ${
            activeTab === 'image'
              ? 'border-[#111111] text-[#111111] font-bold'
              : 'border-transparent text-[#666666] hover:text-[#111111]'
          }`}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          3. Image HD
        </button>
      </div>

      {/* ONGLET 1 : Panoplie de Couleurs du Coton & Taille XS-XXL */}
      {activeTab === 'style' && (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
                Couleur du coton peigné (18 teintes)
              </span>
              <span className="text-[11px] text-[#666666]">
                {activeColorLabel}
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
              {TSHIRT_COLOR_PALETTE.map((swatch) => {
                const isSelected =
                  color.toLowerCase() === swatch.hex.toLowerCase()
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.name}
                    onClick={() => onChangeColor(swatch.hex)}
                    className={`relative h-8 w-full border transition-all ${
                      isSelected
                        ? 'border-[#111111] ring-1 ring-[#111111]'
                        : 'border-[#CCCCCC] hover:border-[#111111]'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={`mx-auto h-3.5 w-3.5 ${
                          ['#f4f4f0', '#ebe5d8', '#d6c7b2', '#a1a1aa'].includes(
                            swatch.hex.toLowerCase()
                          )
                            ? 'text-[#111111]'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Sélecteur de teinte sur-mesure */}
            <div className="mt-2 flex items-center justify-between border border-[#E5E5E5] bg-[#F9F9F9] px-3 py-1.5">
              <span className="text-[11px] text-[#666666]">
                Nuancier libre (Hex) :
              </span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-mono text-[#111111]">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onChangeColor(e.target.value)}
                  className="h-5 w-6 cursor-pointer border border-[#CCCCCC] bg-transparent p-0"
                />
                <span>{color.toUpperCase()}</span>
              </label>
            </div>
          </div>

          {/* Choix de la taille XS à XXL (enregistrée uniquement en backend) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
                Taille de confection (XS à XXL)
              </span>
              <span className="text-[11px] font-semibold text-[#111111]">
                Taille : {size}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {TSHIRT_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChangeSize(s)}
                  className={`border py-2 text-xs font-semibold transition-colors ${
                    size === s
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#CCCCCC] bg-white text-[#111111] hover:border-[#111111]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[#666666]">
              La taille est enregistrée pour la commande et l&apos;atelier (sans déformer le modèle 3D).
            </p>
          </div>
        </div>
      )}

      {/* ONGLET 2 : Panoplie de Typographies & Couleurs d'encre */}
      {activeTab === 'text' && (
        <div className="space-y-3.5">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#111111]">
              Nouveau texte ({activeSide === 'front' ? 'Devant' : 'Dos'})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Saisissez votre texte..."
                className="flex-1 border border-[#CCCCCC] bg-white px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTextElement}
                className="bg-[#111111] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#333333]"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {/* Panoplie visuelle de 16 typographies */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#111111]">
              Panoplie de typographies ({AVAILABLE_FONTS.length} styles)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto border border-[#E5E5E5] p-1.5 bg-[#FAFAFA]">
              {AVAILABLE_FONTS.map((f) => {
                const isSelected = newFont === f.value
                return (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => {
                      setNewFont(f.value)
                      if (
                        selectedElement &&
                        selectedElement.type === 'text' &&
                        !selectedElement.locked
                      ) {
                        onUpdateElement(selectedElement.id, {
                          fontFamily: f.value,
                        })
                        onCommitHistory()
                      }
                    }}
                    className={`flex flex-col items-start justify-center border px-2.5 py-1.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#111111] bg-[#111111] text-white'
                        : 'border-[#E5E5E5] bg-white text-[#111111] hover:border-[#111111]'
                    }`}
                  >
                    <span
                      className="text-xs truncate w-full"
                      style={{ fontFamily: f.value }}
                    >
                      {f.label}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider ${
                        isSelected ? 'text-stone-300' : 'text-[#757575]'
                      }`}
                    >
                      {f.category}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panoplie de couleurs d'encre pour le texte */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
                Couleur d&apos;impression du texte
              </label>
              <input
                type="color"
                value={newTextColor}
                onChange={(e) => {
                  setNewTextColor(e.target.value)
                  if (
                    selectedElement &&
                    selectedElement.type === 'text' &&
                    !selectedElement.locked
                  ) {
                    onUpdateElement(selectedElement.id, {
                      textColor: e.target.value,
                    })
                  }
                }}
                className="h-5 w-6 cursor-pointer border border-[#CCCCCC] bg-white p-0"
                title="Couleur personnalisée"
              />
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {TEXT_COLOR_PALETTE.map((ink) => {
                const active =
                  newTextColor.toLowerCase() === ink.hex.toLowerCase()
                return (
                  <button
                    key={ink.hex}
                    type="button"
                    title={ink.name}
                    onClick={() => {
                      setNewTextColor(ink.hex)
                      if (
                        selectedElement &&
                        selectedElement.type === 'text' &&
                        !selectedElement.locked
                      ) {
                        onUpdateElement(selectedElement.id, {
                          textColor: ink.hex,
                        })
                        onCommitHistory()
                      }
                    }}
                    className={`h-6 w-full border transition-all ${
                      active
                        ? 'border-[#111111] ring-1 ring-[#111111]'
                        : 'border-[#CCCCCC] hover:border-[#111111]'
                    }`}
                    style={{ backgroundColor: ink.hex }}
                  />
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="mb-1 flex justify-between text-[11px] text-[#666666]">
                <span>Densité police</span>
                <span className="font-semibold text-[#111111]">
                  {newFontSize}px
                </span>
              </label>
              <input
                type="range"
                min={32}
                max={68}
                value={newFontSize}
                onChange={(e) => setNewFontSize(Number(e.target.value))}
                className="w-full accent-[#111111]"
              />
            </div>
            <div>
              <label className="mb-1 flex justify-between text-[11px] text-[#666666]">
                <span>Contour ({newStrokeWidth}px)</span>
                <input
                  type="color"
                  value={newStrokeColor}
                  onChange={(e) => setNewStrokeColor(e.target.value)}
                  className="h-4 w-5 cursor-pointer border border-[#CCCCCC] bg-white p-0"
                />
              </label>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={newStrokeWidth}
                onChange={(e) => setNewStrokeWidth(Number(e.target.value))}
                className="w-full accent-[#111111]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 3 : Import d'image PNG/JPG (5 Mo max, résolution min vérifiée) */}
      {activeTab === 'image' && (
        <div className="space-y-3">
          <div className="border border-dashed border-[#CCCCCC] bg-[#FAFAFA] p-5 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <ImagePlus className="mx-auto mb-2 h-6 w-6 text-[#111111]" />
            <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              Importer un visuel sur la face{' '}
              {activeSide === 'front' ? 'DEVANT' : 'DOS'}
            </p>
            <p className="mt-1 text-[11px] text-[#666666]">
              PNG ou JPG haute définition • 5 Mo max • Min. {IMAGE_MIN_WIDTH}×
              {IMAGE_MIN_HEIGHT} px
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 bg-[#111111] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#333333]"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Choisir un fichier
            </button>
          </div>

          {uploadError && (
            <div className="border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* Liste des éléments + Verrouillage (Texte & Image) + Édition directe */}
      <div className="border-t border-[#E5E5E5] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
            Calques ({activeSide === 'front' ? 'Devant' : 'Dos'} :{' '}
            {sideElements.length})
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#666666]">
            <Move className="h-3 w-3" /> Glissez sur le modèle 3D pour déplacer
          </span>
        </div>

        {sideElements.length === 0 ? (
          <p className="border border-[#E5E5E5] bg-[#FAFAFA] p-2.5 text-center text-xs text-[#666666]">
            Aucun élément sur cette face. Ajoutez un texte ou une image.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sideElements.map((el) => {
              const isSelected = el.id === selectedElementId
              const isLocked = Boolean(el.locked)
              return (
                <div
                  key={el.id}
                  className={`inline-flex items-center border text-xs transition-colors ${
                    isSelected
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#CCCCCC] bg-white text-[#111111] hover:border-[#111111]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectElement(el.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                  >
                    {el.type === 'image' ? (
                      <ImagePlus className="h-3.5 w-3.5" />
                    ) : (
                      <Type className="h-3.5 w-3.5" />
                    )}
                    <span className="max-w-[110px] truncate font-medium">
                      {el.type === 'image'
                        ? el.originalFileName || 'Image HD'
                        : el.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    title={
                      isLocked
                        ? 'Déverrouiller cet élément'
                        : 'Verrouiller cet élément sur le modèle'
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdateElement(el.id, { locked: !isLocked })
                      onCommitHistory()
                    }}
                    className={`border-l px-2 py-1.5 transition-colors ${
                      isSelected
                        ? 'border-white/25 hover:bg-white/15'
                        : 'border-[#E5E5E5] hover:bg-[#F5F5F5]'
                    }`}
                    aria-label={
                      isLocked
                        ? 'Déverrouiller cet élément'
                        : 'Verrouiller cet élément'
                    }
                  >
                    {isLocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Unlock className="h-3 w-3 opacity-60" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Contrôles précis de l'élément actif (Verrouillage, Texte, Police, Couleurs, Taille, Rotation, Suppression) */}
        {selectedElement && (
          <div className="mt-3 space-y-3 border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5E5] pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
                Élément actif ({selectedElement.type === 'text' ? 'Texte' : 'Image'})
              </span>

              <div className="flex items-center gap-1.5">
                {/* Bouton Verrouiller / Déverrouiller l'élément */}
                <button
                  type="button"
                  onClick={() => {
                    onUpdateElement(selectedElement.id, {
                      locked: !isSelectedLocked,
                    })
                    onCommitHistory()
                  }}
                  className={`inline-flex items-center gap-1 border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    isSelectedLocked
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#CCCCCC] bg-white text-[#111111] hover:border-[#111111]'
                  }`}
                >
                  {isSelectedLocked ? (
                    <>
                      <Lock className="h-3 w-3" />
                      <span>Verrouillé</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3 w-3" />
                      <span>Verrouiller</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSelectedLocked}
                  onClick={() => onDeleteElement(selectedElement.id)}
                  className="inline-flex items-center gap-1 border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-35"
                >
                  <Trash2 className="h-3 w-3" />
                  Supprimer
                </button>
              </div>
            </div>

            {isSelectedLocked && (
              <div className="border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-[11px] text-[#666666] flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-[#111111] shrink-0" />
                <span>
                  Cet élément est verrouillé sur le t-shirt. Déverrouillez-le pour le déplacer ou le modifier.
                </span>
              </div>
            )}

            {selectedElement.type === 'text' && (
              <div className="space-y-2.5 border-b border-[#E5E5E5] pb-2.5">
                <input
                  type="text"
                  disabled={isSelectedLocked}
                  value={selectedElement.text || ''}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, { text: e.target.value })
                  }
                  onBlur={onCommitHistory}
                  className="w-full border border-[#CCCCCC] bg-white px-2.5 py-1.5 text-xs text-[#111111] focus:border-[#111111] focus:outline-none disabled:bg-[#F0F0F0] disabled:text-[#888888]"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    disabled={isSelectedLocked}
                    value={selectedElement.fontFamily}
                    onChange={(e) => {
                      onUpdateElement(selectedElement.id, {
                        fontFamily: e.target.value,
                      })
                      onCommitHistory()
                    }}
                    className="sm:col-span-2 border border-[#CCCCCC] bg-white px-2 py-1.5 text-xs text-[#111111] disabled:opacity-50"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f.label} value={f.value}>
                        {f.label} ({f.category})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      disabled={isSelectedLocked}
                      title="Couleur du texte"
                      value={selectedElement.textColor || '#FFFFFF'}
                      onChange={(e) =>
                        onUpdateElement(selectedElement.id, {
                          textColor: e.target.value,
                        })
                      }
                      onBlur={onCommitHistory}
                      className="h-7 flex-1 cursor-pointer border border-[#CCCCCC] bg-white p-0.5 disabled:opacity-50"
                    />
                    <input
                      type="color"
                      disabled={isSelectedLocked}
                      title="Couleur du contour"
                      value={selectedElement.strokeColor || '#000000'}
                      onChange={(e) =>
                        onUpdateElement(selectedElement.id, {
                          strokeColor: e.target.value,
                        })
                      }
                      onBlur={onCommitHistory}
                      className="h-7 flex-1 cursor-pointer border border-[#CCCCCC] bg-white p-0.5 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Accès rapide aux couleurs d'encre pour l'élément sélectionné */}
                <div className="grid grid-cols-8 gap-1">
                  {TEXT_COLOR_PALETTE.slice(0, 8).map((ink) => (
                    <button
                      key={ink.hex}
                      type="button"
                      disabled={isSelectedLocked}
                      title={ink.name}
                      onClick={() => {
                        onUpdateElement(selectedElement.id, {
                          textColor: ink.hex,
                        })
                        onCommitHistory()
                      }}
                      className="h-5 w-full border border-[#CCCCCC] hover:border-[#111111] disabled:opacity-40"
                      style={{ backgroundColor: ink.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <label className="flex justify-between text-[#666666]">
                  <span>Échelle sur buste</span>
                  <span className="font-semibold text-[#111111]">
                    {Math.round(selectedElement.scale * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  disabled={isSelectedLocked}
                  min={0.08}
                  max={0.48}
                  step={0.005}
                  value={selectedElement.scale}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      scale: Number(e.target.value),
                    })
                  }
                  onMouseUp={onCommitHistory}
                  onTouchEnd={onCommitHistory}
                  className="mt-1 w-full accent-[#111111] disabled:opacity-40"
                />
              </div>

              <div>
                <label className="flex justify-between text-[#666666]">
                  <span className="flex items-center gap-1">
                    <RotateCw className="h-3 w-3" /> Rotation
                  </span>
                  <span className="font-semibold text-[#111111]">
                    {Math.round((selectedElement.rotation * 180) / Math.PI)}°
                  </span>
                </label>
                <input
                  type="range"
                  disabled={isSelectedLocked}
                  min={-Math.PI}
                  max={Math.PI}
                  step={0.05}
                  value={selectedElement.rotation}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      rotation: Number(e.target.value),
                    })
                  }
                  onMouseUp={onCommitHistory}
                  onTouchEnd={onCommitHistory}
                  className="mt-1 w-full accent-[#111111] disabled:opacity-40"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Case obligatoire de confirmation des droits sur l'image */}
      <label className="flex cursor-pointer items-start gap-2.5 border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-xs text-[#111111]">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(e) => onChangeRightsConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 border-[#CCCCCC] accent-[#111111]"
        />
        <span>
          Je confirme détenir les droits d&apos;impression sur ce visuel
          {hasUploadedImages && (
            <span className="ml-1 font-bold text-[#111111]">(Requis)</span>
          )}
        </span>
      </label>

      {/* Bouton principal sobre style BZB */}
      <button
        type="button"
        disabled={!rightsConfirmed || isAddingToCart}
        onClick={onAddToCart}
        className="flex w-full items-center justify-center gap-2 bg-[#111111] py-3.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#2A2A2A] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ShoppingBag className="h-4 w-4" />
        {isAddingToCart
          ? 'Génération des aperçus 3D Face & Dos...'
          : 'Commander cette création (Mode Test)'}
      </button>
    </div>
  )
}
