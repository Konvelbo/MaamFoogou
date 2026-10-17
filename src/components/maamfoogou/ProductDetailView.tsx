import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  CornerDownRight,
  Edit3,
  Flag,
  FlipHorizontal,
  Heart,
  PackageCheck,
  RefreshCw,
  Share,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react'
import { COMMENT_MAX_LENGTH } from '../../../convex/xpConfig'
import {
  type MaamfoogouDesign,
  addDesignComment,
  adminToggleFeaturedDesign,
  checkVariantStockServer,
  createMobileMoneyOrder,
  deleteDesignComment,
  editDesignComment,
  generateProductShareLink,
  moderateDesignComment,
  openAuthForProtectedAction,
  reportDesignComment,
  toggleDesignLike,
  triggerMobileMoneyWebhook,
  useMaamfoogouStore,
} from '../../services/maamfoogouStore'
import type { MobileMoneyOperator } from '../../../convex/paymentProvider'
import { SceneCanvas } from '../canvas/SceneCanvas'
import { normalizedTo3DElements } from '../../utils/designElementMapper'
import type { TShirtSide, TShirtSize } from '../../types/configurator'

interface ProductDetailViewProps {
  design: MaamfoogouDesign
  onBackToCatalog: () => void
  onOpenCustomizerWithDesign: (design: MaamfoogouDesign) => void
}

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  design,
  onBackToCatalog,
  onOpenCustomizerWithDesign,
}) => {
  const state = useMaamfoogouStore()
  const currentUser = state.users.find((u) => u.id === state.currentUserId)
  const isLiked = state.likes.some(
    (l) => l.userId === state.currentUserId && l.designId === design.id
  )

  const galleryImages = useMemo(() => {
    const base: Array<{
      id: string
      label: string
      side: TShirtSide
      url: string
      color: string
    }> = [
      {
        id: 'front',
        label: 'Vue Face 3D',
        side: 'front',
        url: design.previewFrontUrl,
        color: design.tshirtColor,
      },
      {
        id: 'back',
        label: 'Vue Dos 3D',
        side: 'back',
        url: design.previewBackUrl,
        color: design.tshirtColor,
      },
    ]
    const vars = (design.colorVariants || []).map((v, i) => ({
      id: `var_${i}`,
      label: v.label,
      side: 'front' as TShirtSide,
      url: v.previewUrl,
      color: v.color,
    }))
    return [...base, ...vars]
  }, [design])

  const elements3D = useMemo(
    () => normalizedTo3DElements(design.elements),
    [design.elements]
  )

  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [activeSide3D, setActiveSide3D] = useState<TShirtSide>('front')

  const availableColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of state.stock) {
      if (!map.has(row.color.toLowerCase())) {
        map.set(row.color.toLowerCase(), row.colorName)
      }
    }
    return Array.from(map.entries()).map(([color, colorName]) => ({
      color,
      colorName,
    }))
  }, [state.stock])

  const [selectedColor, setSelectedColor] = useState<string>(
    design.tshirtColor.toLowerCase()
  )
  const [selectedSize, setSelectedSize] = useState<string>(design.size || 'L')
  const [quantity, setQuantity] = useState<number>(1)

  const [showCheckoutForm, setShowCheckoutForm] = useState(false)
  const [operator, setOperator] = useState<MobileMoneyOperator>('orange_money_bf')
  const [phoneNumber, setPhoneNumber] = useState(
    currentUser?.phone || '+226 70 24 88 19'
  )
  const [fullName, setFullName] = useState(
    currentUser?.name || 'Kader Ouédraogo'
  )
  const [city, setCity] = useState(
    currentUser?.geoCoordinates.city || 'Ouagadougou'
  )
  const [district, setDistrict] = useState(
    currentUser?.geoCoordinates.district || 'Patte d’Oie, Secteur 15'
  )
  const [landmark, setLandmark] = useState(
    currentUser?.geoCoordinates.landmark ||
      'À 150m de la pharmacie principale'
  )
  const [orderError, setOrderError] = useState<string | null>(null)
  const [activeOrderRef, setActiveOrderRef] = useState<string | null>(null)
  const [webhookLog, setWebhookLog] = useState<string | null>(null)

  const [copiedShareUrl, setCopiedShareUrl] = useState<string | null>(null)

  const [commentText, setCommentText] = useState('')
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined)
  const [withPhotoReview, setWithPhotoReview] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [commentsPageSize, setCommentsPageSize] = useState(5)

  const stockInfo = checkVariantStockServer(
    selectedColor,
    selectedSize,
    quantity
  )

  const canPurchase =
    stockInfo.status === 'available' || stockInfo.status === 'low'

  const recentOrdersForDesign = state.orders.filter(
    (o) => o.designId === design.id
  )
  const highlightedOrder =
    recentOrdersForDesign.find((o) => o.paymentReference === activeOrderRef) ||
    recentOrdersForDesign[0]

  const myShareLink = state.shareLinks.find(
    (l) => l.userId === state.currentUserId && l.designId === design.id
  )

  const allDesignComments = useMemo(() => {
    return state.comments
      .filter(
        (c) =>
          c.designId === design.id &&
          (c.status !== 'hidden' || currentUser?.role === 'admin')
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [state.comments, design.id, currentUser?.role])

  const visibleComments = allDesignComments.slice(0, commentsPageSize)

  const handleShareClick = () => {
    const url = generateProductShareLink(design.id)
    if (!url) return
    setCopiedShareUrl(url)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault()
    setOrderError(null)

    const result = createMobileMoneyOrder({
      designId: design.id,
      color: selectedColor,
      size: selectedSize,
      quantity,
      operator,
      phoneNumber,
      fullName,
      city,
      district,
      landmark,
    })

    if (!result.success) {
      setOrderError(result.error || 'Impossible de créer la commande.')
      return
    }

    if (result.order) {
      setActiveOrderRef(result.order.paymentReference)
      setShowCheckoutForm(false)
      setWebhookLog(
        `Commande #${result.order.id.slice(-5)} en attente (${result.order.paymentReference}) — ${result.order.quantity} unité(s) réservée(s) 15 min.`
      )
    }
  }

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    setCommentError(null)

    const res = addDesignComment({
      designId: design.id,
      text: commentText,
      parentId: replyToId,
      photoUrl: withPhotoReview ? design.previewFrontUrl : undefined,
    })

    if (!res.success) {
      setCommentError(res.error || 'Erreur lors de l’envoi du commentaire.')
      return
    }

    setCommentText('')
    setReplyToId(undefined)
    setWithPhotoReview(false)
  }

  const currentSelectedColorName =
    availableColors.find((c) => c.color === selectedColor)?.colorName ||
    selectedColor

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-6 space-y-12">
      {/* En-tête PDP fidèle à BZB : Fil d'ariane + Ligne Retour à gauche / Cœur + Partage à droite */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-[#666666]">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="hover:text-[#111111] transition-colors"
          >
            Vêtements
          </button>
          <span>&gt;</span>
          <button
            type="button"
            onClick={onBackToCatalog}
            className="hover:text-[#111111] transition-colors"
          >
            T-shirt
          </button>
          <span>&gt;</span>
          <span className="text-[#111111] font-medium truncate">
            {design.name}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#111111] hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <div className="flex items-center gap-3">
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() =>
                  adminToggleFeaturedDesign(design.id, !design.featured)
                }
                className="px-3 py-1.5 text-[11px] font-medium border border-[#CCCCCC] rounded-[4px] hover:border-[#111111] transition-colors"
              >
                {design.featured ? 'Retirer de l’accueil' : 'Épingler accueil'}
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleDesignLike(design.id)}
              className="inline-flex items-center gap-1.5 p-1.5 text-[#111111] hover:opacity-70 transition-opacity"
              title="Liker et sauvegarder dans Mes collections"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-xs">{design.likesCount}</span>
            </button>

            <button
              type="button"
              onClick={handleShareClick}
              className="p-1.5 text-[#111111] hover:opacity-70 transition-opacity"
              title="Copier mon lien de partage (?ref=)"
            >
              <Share className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grille principale PDP style BZB : Image principale + colonne verticale de miniatures + colonne détails */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Galerie 3D interactive : Scène 3D principale + colonne verticale de miniatures à droite */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row gap-3">
          {/* Scène 3D interactive à bords francs (rounded-none, aucun rounded > 8px) */}
          <div className="relative flex-1 aspect-[3/4] min-h-[440px] sm:min-h-[540px] bg-[#18181B] rounded-none overflow-hidden [&>div]:!rounded-none [&>div]:!border-0">
            <SceneCanvas
              color={selectedColor}
              size={(selectedSize as TShirtSize) || 'L'}
              activeSide={activeSide3D}
              zoom={1.08}
              isFrozen={false}
              elements={elements3D}
              selectedElementId={null}
            />

            <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#0F5132] text-white rounded-[4px]">
                {design.source === 'team'
                  ? 'COLLECTION 3D FASO'
                  : `CRÉATEUR : ${design.creatorName}`}
              </span>
            </div>

            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveSide3D((s) => (s === 'front' ? 'back' : 'front'))
                }
                className="px-3 py-1.5 bg-white/90 hover:bg-white text-[#111111] text-xs font-medium rounded-[4px] flex items-center gap-1.5 transition-colors"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>
                  Basculer vue 3D ({activeSide3D === 'front' ? 'Devant' : 'Dos'})
                </span>
              </button>
            </div>
          </div>

          {/* Colonne verticale de sélection d'angle 3D & teinte (aucun SVG 2D affiché) */}
          <div className="flex sm:flex-col gap-2.5 sm:w-20 shrink-0 overflow-x-auto">
            {galleryImages.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => {
                  setSelectedImageIdx(idx)
                  setActiveSide3D(img.side)
                  if (img.color) {
                    setSelectedColor(img.color.toLowerCase())
                  }
                }}
                className={`w-16 sm:w-20 aspect-[3/4] bg-[#F5F5F5] rounded-none overflow-hidden shrink-0 border transition-colors flex flex-col items-center justify-center gap-2 p-2 ${
                  idx === selectedImageIdx
                    ? 'border-[#111111]'
                    : 'border-[#E5E5E5] hover:border-[#999999]'
                }`}
              >
                <span
                  className="w-7 h-7 rounded-[2px] border border-[#CCCCCC]"
                  style={{ backgroundColor: img.color }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-tight text-[#111111] text-center leading-tight">
                  {img.id === 'front'
                    ? 'Face 3D'
                    : img.id === 'back'
                      ? 'Dos 3D'
                      : img.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Colonne Droite : Informations épurées (sans bordure de boîte englobante, comme BZB) */}
        <div className="lg:col-span-5 space-y-6 lg:pl-4">
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-normal text-[#111111]">
              {design.name} - {currentSelectedColorName}
            </h1>

            <div className="flex items-center justify-between">
              <span className="text-lg font-normal text-[#111111]">
                {design.price.toLocaleString('fr-FR')} FCFA
              </span>
              <span className="text-xs text-[#666666]">
                +{design.source === 'creator' ? '120' : '150'} XP à l’achat
              </span>
            </div>

            <p className="text-xs text-[#666666] leading-relaxed pt-1">
              {design.description}
            </p>
          </div>

          {/* Sélecteur Couleur (avec aperçus rectangulaires style BZB) */}
          <div className="space-y-2.5">
            <div className="text-xs text-[#111111]">
              <span className="font-semibold">Couleur</span>{' '}
              <span className="text-[#666666]">{currentSelectedColorName}</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {availableColors.map((c) => {
                const hasAnySizeAvailable = ALL_SIZES.some((sz) => {
                  const st = checkVariantStockServer(c.color, sz, 1)
                  return st.status === 'available' || st.status === 'low'
                })
                const isSelected = selectedColor === c.color

                return (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setSelectedColor(c.color)}
                    title={c.colorName}
                    className={`p-2 bg-[#F5F5F5] rounded-none border transition-colors flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? 'border-[#111111]'
                        : 'border-transparent hover:border-[#CCCCCC]'
                    } ${!hasAnySizeAvailable ? 'opacity-45' : ''}`}
                  >
                    <span
                      className="w-7 h-7 rounded-[2px] border border-[#D4D4D4]"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-[10px] text-[#111111] truncate w-full text-center">
                      {c.colorName}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sélecteur Taille (boutons épurés <= 6px d'arrondi) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#111111]">Taille</span>
              <span className="text-[#666666] underline">Guide des tailles</span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {ALL_SIZES.map((sz) => {
                const st = checkVariantStockServer(selectedColor, sz, 1)
                const isOut =
                  st.status === 'out_of_stock' || st.status === 'unavailable'
                const isSelected = selectedSize === sz

                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`h-9 text-xs rounded-[4px] border transition-colors ${
                      isSelected
                        ? 'bg-[#111111] text-white border-[#111111] font-medium'
                        : isOut
                          ? 'bg-white text-[#BDBDBD] border-[#E5E5E5] line-through'
                          : 'bg-white text-[#111111] border-[#E5E5E5] hover:border-[#111111]'
                    }`}
                  >
                    {sz}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quantité & État du stock en temps réel (Section 8.1) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111111]">
                Quantité
              </span>
              <div className="inline-flex items-center border border-[#CCCCCC] rounded-[4px]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1 text-xs text-[#111111] hover:bg-[#F5F5F5]"
                >
                  -
                </button>
                <span className="px-3.5 py-1 text-xs font-medium text-[#111111] border-x border-[#E5E5E5]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3 py-1 text-xs text-[#111111] hover:bg-[#F5F5F5]"
                >
                  +
                </button>
              </div>
            </div>

            {stockInfo.status === 'available' && (
              <div className="p-2.5 rounded-[4px] bg-[#F7F7F7] border border-[#E5E5E5] text-[#111111] text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-[#0F5132]" />
                  En stock ({stockInfo.available} disponible(s))
                </span>
                {stockInfo.reserved > 0 && (
                  <span className="text-[11px] text-[#666666]">
                    {stockInfo.reserved} réservé(s)
                  </span>
                )}
              </div>
            )}

            {stockInfo.status === 'low' && (
              <div className="p-2.5 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <span className="font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {stockInfo.message}
                </span>
              </div>
            )}

            {stockInfo.status === 'partial' && (
              <div className="p-3 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>{stockInfo.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuantity(stockInfo.available)}
                  className="px-3 py-1.5 bg-[#111111] text-white text-xs rounded-[4px] hover:bg-[#333333] transition-colors"
                >
                  Ajuster la quantité à {stockInfo.available}
                </button>
              </div>
            )}

            {(stockInfo.status === 'out_of_stock' ||
              stockInfo.status === 'unavailable') && (
              <div className="p-2.5 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{stockInfo.message}</span>
              </div>
            )}
          </div>

          {/* Boutons d'action épurés (rounded-[4px]) */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              disabled={!canPurchase}
              onClick={() => {
                if (!state.currentUserId) {
                  openAuthForProtectedAction({
                    type: 'buy_now',
                    designId: design.id,
                  })
                  return
                }
                setShowCheckoutForm((prev) => !prev)
              }}
              className={`w-full h-11 px-4 rounded-[4px] text-xs font-medium transition-colors ${
                canPurchase
                  ? 'bg-[#111111] text-white hover:bg-[#333333]'
                  : 'bg-[#E5E5E5] text-[#888888] cursor-not-allowed'
              }`}
            >
              {canPurchase
                ? `Acheter avec Mobile Money — ${(design.price * quantity).toLocaleString('fr-FR')} FCFA`
                : 'Indisponible'}
            </button>

            <button
              type="button"
              onClick={() => onOpenCustomizerWithDesign(design)}
              className="w-full h-11 px-4 rounded-[4px] border border-[#111111] bg-white hover:bg-[#F7F7F7] text-[#111111] text-xs font-medium transition-colors"
            >
              Personnaliser ce modèle en 3D
            </button>
          </div>

          {/* Formulaire Mobile Money (rounded-[4px]) */}
          {showCheckoutForm && canPurchase && (
            <form
              onSubmit={handleCreateOrder}
              className="p-4 rounded-[4px] bg-[#F7F7F7] border border-[#E5E5E5] space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111111]">
                  Paiement Mobile Money (Burkina Faso)
                </span>
                <span className="text-[#666666]">Réservation 15 min</span>
              </div>

              {orderError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[4px]">
                  {orderError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'orange_money_bf', label: 'Orange Money' },
                  { id: 'moov_money_bf', label: 'Moov Money' },
                  { id: 'wave_bf', label: 'Wave BF' },
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setOperator(op.id as MobileMoneyOperator)}
                    className={`py-2 px-2 text-xs rounded-[4px] border transition-colors ${
                      operator === op.id
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#111111] border-[#CCCCCC]'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Téléphone Mobile Money"
                  className="w-full h-9 px-2.5 text-xs bg-white border border-[#CCCCCC] rounded-[4px]"
                />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nom complet"
                  className="w-full h-9 px-2.5 text-xs bg-white border border-[#CCCCCC] rounded-[4px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ville"
                  className="w-full h-9 px-2.5 text-xs bg-white border border-[#CCCCCC] rounded-[4px]"
                />
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Quartier / Secteur"
                  className="w-full h-9 px-2.5 text-xs bg-white border border-[#CCCCCC] rounded-[4px]"
                />
              </div>

              <input
                type="text"
                required
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Point de repère précis"
                className="w-full h-9 px-2.5 text-xs bg-white border border-[#CCCCCC] rounded-[4px]"
              />

              <button
                type="submit"
                className="w-full h-10 bg-[#111111] hover:bg-[#333333] text-white text-xs font-medium rounded-[4px] transition-colors"
              >
                Confirmer la réservation ({(design.price * quantity).toLocaleString('fr-FR')} FCFA)
              </button>
            </form>
          )}

          {/* Simulateur Webhook Mobile Money (Section 8.2, 8.3 & 11) */}
          {highlightedOrder && (
            <div className="p-4 rounded-[4px] bg-[#F7F7F7] border border-[#E5E5E5] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#111111]">
                  Webhook Prestataire Mobile Money
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium border border-[#CCCCCC] bg-white rounded-[4px]">
                  {highlightedOrder.status.toUpperCase()}
                </span>
              </div>

              <p className="text-[#666666]">
                Réf : <code className="text-[#111111]">{highlightedOrder.paymentReference}</code> • USSD :{' '}
                <code className="text-[#111111]">{highlightedOrder.ussdPromptCode}</code>
              </p>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const res = triggerMobileMoneyWebhook(
                      highlightedOrder.paymentReference,
                      'SUCCESS'
                    )
                    setWebhookLog(res.message)
                  }}
                  className="py-1.5 px-2 bg-[#111111] text-white text-[11px] rounded-[4px] flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SUCCESS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = triggerMobileMoneyWebhook(
                      highlightedOrder.paymentReference,
                      'FAILED'
                    )
                    setWebhookLog(res.message)
                  }}
                  className="py-1.5 px-2 border border-[#CCCCCC] bg-white text-[#111111] text-[11px] rounded-[4px] flex items-center justify-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  FAILED
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = triggerMobileMoneyWebhook(
                      highlightedOrder.paymentReference,
                      'EXPIRED'
                    )
                    setWebhookLog(res.message)
                  }}
                  className="py-1.5 px-2 border border-[#CCCCCC] bg-white text-[#111111] text-[11px] rounded-[4px] flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  EXPIRED
                </button>
              </div>

              {webhookLog && (
                <div className="p-2 bg-white border border-[#E5E5E5] rounded-[4px] text-[11px] text-[#111111]">
                  {webhookLog}
                </div>
              )}
            </div>
          )}

          {/* Lien de partage copié (?ref=CODE) */}
          {copiedShareUrl && (
            <div className="p-3 bg-[#F7F7F7] border border-[#E5E5E5] rounded-[4px] text-xs flex items-center justify-between gap-2">
              <code className="truncate text-[#111111]">{copiedShareUrl}</code>
              <span className="font-medium shrink-0 flex items-center gap-1 text-[#0F5132]">
                <Check className="w-3.5 h-3.5" /> Copié
              </span>
            </div>
          )}

          {myShareLink && (
            <div className="text-xs text-[#666666] flex items-center justify-between pt-2 border-t border-[#E5E5E5]">
              <span>Lien tracking : {myShareLink.code}</span>
              <span>
                {myShareLink.clicksCount} clic(s) • {myShareLink.purchasesCount}{' '}
                achat(s)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 6 : COMMENTAIRES EN TEMPS RÉEL (Design épuré, aucun rounded > 6px) */}
      <section className="border-t border-[#E5E5E5] pt-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111111]">
              Avis & Commentaires ({design.commentsCount})
            </h2>
            <p className="text-xs text-[#666666]">
              Temps réel Convex • +10 XP par commentaire • +100 XP avec photo portée
            </p>
          </div>
        </div>

        <form onSubmit={handlePostComment} className="space-y-3 max-w-3xl">
          {replyToId && (
            <div className="flex items-center justify-between bg-[#F7F7F7] border border-[#E5E5E5] px-3 py-1.5 rounded-[4px] text-xs">
              <span className="flex items-center gap-1.5">
                <CornerDownRight className="w-3.5 h-3.5" />
                Réponse à un commentaire
              </span>
              <button
                type="button"
                onClick={() => setReplyToId(undefined)}
                className="underline"
              >
                Annuler
              </button>
            </div>
          )}

          {commentError && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[4px]">
              {commentError}
            </div>
          )}

          <div className="relative">
            <textarea
              rows={3}
              maxLength={COMMENT_MAX_LENGTH}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                currentUser
                  ? 'Votre avis sur ce modèle (max 500 caractères)...'
                  : 'Connectez-vous pour publier un avis...'
              }
              className="w-full p-3 text-xs border border-[#CCCCCC] rounded-[4px] focus:outline-none focus:border-[#111111]"
            />
            <span className="absolute bottom-2 right-3 text-[11px] text-[#757575]">
              {commentText.length}/{COMMENT_MAX_LENGTH}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-[#111111] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withPhotoReview}
                onChange={(e) => setWithPhotoReview(e.target.checked)}
                className="rounded-[2px] border-[#CCCCCC]"
              />
              <Camera className="w-4 h-4 text-[#666666]" />
              <span>Joindre une photo portée (+100 XP)</span>
            </label>

            <button
              type="submit"
              className="px-5 h-9 bg-[#111111] hover:bg-[#333333] text-white text-xs font-medium rounded-[4px] transition-colors"
            >
              Publier
            </button>
          </div>
        </form>

        <div className="divide-y divide-[#E5E5E5] max-w-3xl">
          {visibleComments.map((c) => {
            const isAuthor = state.currentUserId === c.userId
            const isCreator = c.userId === design.ownerId
            const isAdmin = currentUser?.role === 'admin'

            return (
              <div
                key={c.id}
                className={`py-4 space-y-2 ${
                  c.parentId ? 'pl-6 bg-[#FAFAFA]' : ''
                } ${c.status === 'hidden' ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-[4px] bg-[#111111] text-white text-[11px] font-semibold flex items-center justify-center">
                      {c.authorName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-[#111111]">
                      {c.authorName}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] border border-[#E5E5E5] bg-[#F7F7F7] text-[#111111] rounded-[3px]">
                      Niv. {c.authorLevel}
                    </span>
                    {isCreator && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-[#111111] text-white rounded-[3px]">
                        Créateur
                      </span>
                    )}
                    {c.status === 'reported' && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded-[3px]">
                        Signalé
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-[#757575]">
                    {new Date(c.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {c.editedAt && ' (modifié)'}
                  </span>
                </div>

                {editingCommentId === c.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      maxLength={COMMENT_MAX_LENGTH}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-2 text-xs border border-[#CCCCCC] rounded-[4px]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          editDesignComment(c.id, editingText)
                          setEditingCommentId(null)
                        }}
                        className="px-3 py-1 bg-[#111111] text-white text-xs rounded-[4px]"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCommentId(null)}
                        className="px-3 py-1 border border-[#CCCCCC] text-xs rounded-[4px]"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#333333] leading-relaxed">
                    {c.text}
                  </p>
                )}

                {c.photoUrl && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F5F5F5] border border-[#E5E5E5] rounded-[4px] text-[11px] text-[#111111]">
                    <Camera className="w-3.5 h-3.5 text-[#0F5132]" />
                    Avis vérifié avec photo portée (+100 XP)
                  </span>
                )}

                <div className="flex items-center gap-4 text-[11px] text-[#666666]">
                  <button
                    type="button"
                    onClick={() => setReplyToId(c.id)}
                    className="hover:text-[#111111] flex items-center gap-1"
                  >
                    <CornerDownRight className="w-3 h-3" /> Répondre
                  </button>

                  {isAuthor && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(c.id)
                          setEditingText(c.text)
                        }}
                        className="hover:text-[#111111] flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDesignComment(c.id)}
                        className="hover:text-red-600 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
                    </>
                  )}

                  {!isAuthor && (
                    <button
                      type="button"
                      onClick={() => reportDesignComment(c.id)}
                      className="hover:text-[#111111] flex items-center gap-1"
                    >
                      <Flag className="w-3 h-3" /> Signaler
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        moderateDesignComment(
                          c.id,
                          c.status === 'hidden' ? 'visible' : 'hidden'
                        )
                      }
                      className="text-red-700 hover:underline flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      {c.status === 'hidden' ? 'Rétablir' : 'Masquer'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {allDesignComments.length > commentsPageSize && (
          <button
            type="button"
            onClick={() => setCommentsPageSize((s) => s + 5)}
            className="px-5 h-9 border border-[#111111] rounded-[4px] text-xs font-medium text-[#111111] hover:bg-[#F7F7F7] transition-colors"
          >
            Afficher plus d’avis ({allDesignComments.length - commentsPageSize})
          </button>
        )}
      </section>
    </div>
  )
}
