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
  BASE_TSHIRT_PRICE,
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_MIN_HEIGHT,
  IMAGE_MIN_WIDTH,
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
  const [newText, setNewText] = useState('VOTRE TEXTE')
  const [newFont, setNewFont] = useState<string>(AVAILABLE_FONTS[0].value)
  const [newTextColor, setNewTextColor] = useState('#FFFFFF')
  const [newFontSize, setNewFontSize] = useState(56)
  const [newStrokeColor, setNewStrokeColor] = useState('#1C1D21')
  const [newStrokeWidth, setNewStrokeWidth] = useState(2)

  const selectedElement =
    elements.find((el) => el.id === selectedElementId) || null
  const sideElements = elements.filter((el) => el.side === activeSide)
  const hasUploadedImages = elements.some((el) => el.type === 'image')

  /**
   * Validation stricte et import d'une image (PNG/JPG, <= 5 Mo, résolution >= 500x500 px)
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Vérification du format MIME
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Format non supporté. Veuillez importer un fichier PNG ou JPG.')
      e.target.value = ''
      return
    }

    // 2. Vérification du poids maximal (5 Mo)
    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
      setUploadError(
        `Le fichier fait ${sizeMb} Mo. La taille maximale autorisée est de 5 Mo.`
      )
      e.target.value = ''
      return
    }

    // 3. Vérification de la résolution minimale (500 x 500 px)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const img = new Image()
      img.onload = () => {
        if (img.width < IMAGE_MIN_WIDTH || img.height < IMAGE_MIN_HEIGHT) {
          setUploadError(
            `Résolution insuffisante (${img.width}×${img.height} px). Minimum requis : ${IMAGE_MIN_WIDTH}×${IMAGE_MIN_HEIGHT} px pour une impression nette.`
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
      scale: 0.18,
      text: newText.trim(),
      fontFamily: newFont,
      fontSize: newFontSize,
      textColor: newTextColor,
      strokeColor: newStrokeColor,
      strokeWidth: newStrokeWidth,
    }
    onAddElement(textEl)
  }

  // Prix dynamique selon le nombre de marquages personnalisés
  const unitPrice = BASE_TSHIRT_PRICE + elements.length * 3.5

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 text-zinc-100 shadow-2xl backdrop-blur-md sm:p-5">
      {/* Barre supérieure : Bascule Devant/Dos, Zoom et Annuler/Rétablir */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-xl bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => onChangeSide('front')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeSide === 'front'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
              Devant
            </button>
            <button
              type="button"
              onClick={() => onChangeSide('back')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeSide === 'back'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FlipHorizontal className="h-3.5 w-3.5 scale-x-[-1]" />
              Dos
            </button>
          </div>

          {/* Bouton pour figer/libérer le modèle 3D afin de faciliter les modifications */}
          <button
            type="button"
            onClick={onToggleFrozen}
            title="Figer le t-shirt et verrouiller la caméra pour déplacer facilement les éléments"
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              isFrozen
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-500/10'
                : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:text-white'
            }`}
          >
            {isFrozen ? (
              <>
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                <span>Modèle figé</span>
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5 text-amber-400" />
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
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Rétablir (Redo)"
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:opacity-35"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="ml-1 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1">
            <ZoomIn className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="range"
              min={0.8}
              max={1.45}
              step={0.05}
              value={zoom}
              onChange={(e) => onChangeZoom(Number(e.target.value))}
              className="h-1.5 w-16 accent-amber-500"
              aria-label="Niveau de zoom 3D"
            />
          </div>
        </div>
      </div>

      {/* Navigation par onglets de personnalisation */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-zinc-950 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('style')}
          className={`rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === 'style'
              ? 'bg-zinc-800 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          1. Tissu & Taille
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('image')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === 'image'
              ? 'bg-zinc-800 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          2. Image HD
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === 'text'
              ? 'bg-zinc-800 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Type className="h-3.5 w-3.5" />
          3. Texte
        </button>
      </div>

      {/* ONGLET 1 : Couleur du coton & Taille XS-XXL */}
      {activeTab === 'style' && (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Couleur du coton peigné
              </span>
              <span className="font-mono text-xs text-zinc-400">{color}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {TSHIRT_COLOR_PALETTE.map((swatch) => {
                const isSelected =
                  color.toLowerCase() === swatch.hex.toLowerCase()
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.name}
                    onClick={() => onChangeColor(swatch.hex)}
                    className={`relative h-8 w-8 rounded-full border transition-transform ${
                      isSelected
                        ? 'scale-110 border-amber-400 ring-2 ring-amber-400/40'
                        : 'border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={`mx-auto h-4 w-4 ${
                          swatch.hex === '#F4F4F0' || swatch.hex === '#D6C7B2'
                            ? 'text-zinc-900'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                )
              })}

              {/* Sélecteur de couleur libre */}
              <label
                title="Sélecteur de couleur libre"
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-950 px-2.5 text-xs text-zinc-300 hover:border-zinc-500"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onChangeColor(e.target.value)}
                  className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span>Libre</span>
              </label>
            </div>
          </div>

          {/* Choix de la taille XS à XXL */}
          <div>
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Taille de coupe (XS à XXL)
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              {TSHIRT_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChangeSize(s)}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    size === s
                      ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : Import d'image PNG/JPG (5 Mo max, résolution min vérifiée) */}
      {activeTab === 'image' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <ImagePlus className="mx-auto mb-2 h-7 w-7 text-amber-400" />
            <p className="text-xs font-medium text-zinc-200">
              Plaquez votre visuel sur la face{' '}
              <span className="font-bold text-amber-400">
                {activeSide === 'front' ? 'DEVANT' : 'DOS'}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              PNG ou JPG • 5 Mo max • Résolution min. {IMAGE_MIN_WIDTH}×
              {IMAGE_MIN_HEIGHT} px
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
            >
              <ImagePlus className="h-4 w-4" />
              Importer une image
            </button>
          </div>

          {uploadError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 3 : Ajout de Texte (police, couleur, taille, contour) */}
      {activeTab === 'text' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Texte à plaquer ({activeSide === 'front' ? 'Devant' : 'Dos'})
            </label>
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Saisissez votre texte..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Police
              </label>
              <select
                value={newFont}
                onChange={(e) => setNewFont(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                {AVAILABLE_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Taille police ({newFontSize}px)
              </label>
              <input
                type="range"
                min={28}
                max={88}
                value={newFontSize}
                onChange={(e) => setNewFontSize(Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Couleur texte
              </label>
              <input
                type="color"
                value={newTextColor}
                onChange={(e) => setNewTextColor(e.target.value)}
                className="h-8 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Couleur contour
              </label>
              <input
                type="color"
                value={newStrokeColor}
                onChange={(e) => setNewStrokeColor(e.target.value)}
                className="h-8 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Épaisseur contour ({newStrokeWidth})
              </label>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={newStrokeWidth}
                onChange={(e) => setNewStrokeWidth(Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddTextElement}
            className="w-full rounded-xl bg-amber-500 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
          >
            + Ajouter ce texte sur le t-shirt
          </button>
        </div>
      )}

      {/* Liste et édition directe de l'élément sélectionné sur le t-shirt */}
      <div className="border-t border-zinc-800 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Éléments ({activeSide === 'front' ? 'Devant' : 'Dos'} :{' '}
            {sideElements.length})
          </span>
          <span className="flex items-center gap-1 text-[11px] text-amber-400">
            <Move className="h-3 w-3" /> Glissez sur le t-shirt 3D pour déplacer
          </span>
        </div>

        {sideElements.length === 0 ? (
          <p className="rounded-xl bg-zinc-950/60 p-2.5 text-center text-xs text-zinc-500">
            Aucun élément sur cette face. Ajoutez une image ou un texte.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sideElements.map((el) => (
              <button
                key={el.id}
                type="button"
                onClick={() => onSelectElement(el.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  el.id === selectedElementId
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {el.type === 'image' ? (
                  <ImagePlus className="h-3.5 w-3.5" />
                ) : (
                  <Type className="h-3.5 w-3.5" />
                )}
                <span className="max-w-[110px] truncate">
                  {el.type === 'image'
                    ? el.originalFileName || 'Image HD'
                    : el.text}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Contrôles précis de l'élément actif (Position, Taille, Rotation, Texte/Contour, Suppression) */}
        {selectedElement && (
          <div className="mt-3 space-y-2.5 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400">
                Réglages de l&apos;élément sélectionné
              </span>
              <button
                type="button"
                onClick={() => onDeleteElement(selectedElement.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/25"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            </div>

            {selectedElement.type === 'text' && (
              <div className="space-y-2 border-b border-zinc-800 pb-2.5">
                <input
                  type="text"
                  value={selectedElement.text || ''}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, { text: e.target.value })
                  }
                  onBlur={onCommitHistory}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-white"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={selectedElement.fontFamily}
                    onChange={(e) => {
                      onUpdateElement(selectedElement.id, {
                        fontFamily: e.target.value,
                      })
                      onCommitHistory()
                    }}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-white"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="color"
                    title="Couleur du texte"
                    value={selectedElement.textColor || '#FFFFFF'}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        textColor: e.target.value,
                      })
                    }
                    onBlur={onCommitHistory}
                    className="h-7 w-full cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                  />
                  <input
                    type="color"
                    title="Couleur du contour"
                    value={selectedElement.strokeColor || '#000000'}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        strokeColor: e.target.value,
                      })
                    }
                    onBlur={onCommitHistory}
                    className="h-7 w-full cursor-pointer rounded border border-zinc-800 bg-zinc-900"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
              <div>
                <label className="flex justify-between text-zinc-400">
                  <span>Taille (Échelle)</span>
                  <span>{Math.round(selectedElement.scale * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0.08}
                  max={0.42}
                  step={0.01}
                  value={selectedElement.scale}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      scale: Number(e.target.value),
                    })
                  }
                  onMouseUp={onCommitHistory}
                  onTouchEnd={onCommitHistory}
                  className="mt-1 w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-zinc-400">
                  <span className="flex items-center gap-1">
                    <RotateCw className="h-3 w-3" /> Rotation
                  </span>
                  <span>
                    {Math.round((selectedElement.rotation * 180) / Math.PI)}°
                  </span>
                </label>
                <input
                  type="range"
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
                  className="mt-1 w-full accent-amber-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Case obligatoire de confirmation des droits sur l'image */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-300 transition hover:border-zinc-700">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(e) => onChangeRightsConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-700 accent-amber-500"
        />
        <span>
          Je confirme avoir les droits sur cette image
          {hasUploadedImages && (
            <span className="ml-1 font-semibold text-amber-400">(Obligatoire)</span>
          )}
        </span>
      </label>

      {/* Bouton d'ajout au panier avec capture 3D automatique devant et dos */}
      <button
        type="button"
        disabled={!rightsConfirmed || isAddingToCart}
        onClick={onAddToCart}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ShoppingBag className="h-4 w-4" />
        {isAddingToCart
          ? 'Génération des aperçus 3D Devant & Dos...'
          : `Ajouter au panier • ${unitPrice.toFixed(2)} €`}
      </button>
    </div>
  )
}
