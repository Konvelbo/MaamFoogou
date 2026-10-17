import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Eye,
  FlipHorizontal,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { CATALOG_PRODUCTS, TSHIRT_SIZES } from '../../config/constants'
import { SceneCanvas } from '../canvas/SceneCanvas'
import type { SceneCanvasHandle } from '../canvas/SceneCanvas'
import type {
  CartItem,
  CatalogProduct,
  TShirtSide,
  TShirtSize,
} from '../../types/configurator'

interface CatalogSectionProps {
  onCustomizeProduct: (product: CatalogProduct) => void
  onAddCatalogItemToCart: (item: CartItem) => void
}

export function CatalogSection({
  onCustomizeProduct,
  onAddCatalogItemToCart,
}: CatalogSectionProps) {
  const [selectedProduct, setSelectedProduct] =
    useState<CatalogProduct | null>(null)
  const [selectedSize, setSelectedSize] = useState<TShirtSize>('L')
  const [previewSide, setPreviewSide] = useState<TShirtSide>('front')
  const [rightsConfirmed, setRightsConfirmed] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  const productSceneRef = useRef<SceneCanvasHandle | null>(null)

  const handleOpenProduct = (product: CatalogProduct) => {
    setSelectedProduct(product)
    setSelectedSize(product.defaultSize)
    setPreviewSide('front')
    setRightsConfirmed(true)
  }

  const handleAddProductToCart = async () => {
    if (!selectedProduct || !rightsConfirmed) return
    setIsCapturing(true)

    try {
      const previews =
        (await productSceneRef.current?.captureFrontAndBackPreviews()) || {
          frontDataUrl: '',
          backDataUrl: '',
        }

      onAddCatalogItemToCart({
        id: `cart-${Date.now()}`,
        productName: selectedProduct.name,
        color: selectedProduct.defaultColor,
        size: selectedSize,
        quantity: 1,
        unitPrice: selectedProduct.price,
        elements: selectedProduct.elements.map((el) => ({ ...el })),
        frontPreviewDataUrl: previews.frontDataUrl,
        backPreviewDataUrl: previews.backDataUrl,
        rightsConfirmed: true,
      })
    } finally {
      setIsCapturing(false)
    }
  }

  // VUE PAGE PRODUIT DÉTAILLÉE AVEC APERÇU 3D INTERACTIF
  if (selectedProduct) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelectedProduct(null)}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue
        </button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Aperçu 3D interactif du modèle du catalogue */}
          <div className="relative h-[420px] sm:h-[520px] lg:col-span-7">
            <SceneCanvas
              ref={productSceneRef}
              color={selectedProduct.defaultColor}
              size={selectedSize}
              activeSide={previewSide}
              zoom={1.05}
              elements={selectedProduct.elements}
              selectedElementId={null}
            />

            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPreviewSide((s) => (s === 'front' ? 'back' : 'front'))
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-zinc-900/85 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-zinc-800"
              >
                <FlipHorizontal className="h-4 w-4 text-amber-400" />
                Basculer vue ({previewSide === 'front' ? 'Devant' : 'Dos'})
              </button>
            </div>
          </div>

          {/* Informations produit, choix de taille et actions */}
          <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 lg:col-span-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                    Collection Prêt-à-Porter 3D
                  </span>
                  <h2 className="mt-2 text-2xl font-bold text-white">
                    {selectedProduct.name}
                  </h2>
                </div>
                <span className="text-2xl font-extrabold text-amber-400">
                  {selectedProduct.price.toFixed(2)} €
                </span>
              </div>

              <p className="text-sm leading-relaxed text-zinc-400">
                {selectedProduct.description}
              </p>

              {/* Sélecteur de taille */}
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Choisir la taille
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {TSHIRT_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                        selectedSize === s
                          ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Détail des marquages inclus */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs text-zinc-300">
                <p className="font-semibold text-zinc-200">
                  Éléments graphiques inclus ({selectedProduct.elements.length}) :
                </p>
                <ul className="mt-1.5 space-y-1 text-zinc-400">
                  {selectedProduct.elements.map((el) => (
                    <li key={el.id}>
                      • Face {el.side === 'front' ? 'Devant' : 'Dos'} : «{' '}
                      {el.text || el.originalFileName} »
                    </li>
                  ))}
                </ul>
              </div>

              {/* Case obligatoire de confirmation des droits */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-amber-500"
                />
                <span>Je confirme avoir les droits sur cette image</span>
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => onCustomizeProduct(selectedProduct)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 px-4 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
              >
                <Sparkles className="h-4 w-4" />
                Personnaliser en 3D
              </button>
              <button
                type="button"
                disabled={!rightsConfirmed || isCapturing}
                onClick={handleAddProductToCart}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 px-4 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-45"
              >
                <ShoppingBag className="h-4 w-4" />
                {isCapturing ? 'Capture 3D...' : 'Ajouter au panier'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // VUE LISTE DU CATALOGUE DE T-SHIRTS PRÉ-CONFIGURÉS
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Catalogue de T-Shirts Pré-conçus
          </h2>
          <p className="text-sm text-zinc-400">
            Explorez nos créations en coton peigné 220g/m² avec aperçu 3D temps
            réel ou personnalisez-les dans le configurateur.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CATALOG_PRODUCTS.map((product) => {
          const frontElement = product.elements.find(
            (el) => el.side === 'front'
          )
          return (
            <div
              key={product.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 transition hover:border-amber-500/50"
            >
              {/* Vignette stylisée représentant la teinte du t-shirt et son marquage */}
              <div
                onClick={() => handleOpenProduct(product)}
                className="relative flex h-56 cursor-pointer flex-col items-center justify-center p-6 transition group-hover:scale-[1.02]"
                style={{
                  background: `radial-gradient(circle at 50% 45%, ${product.defaultColor} 0%, #09090b 95%)`,
                }}
              >
                <div
                  className="flex h-36 w-32 flex-col items-center justify-center rounded-2xl border border-white/15 shadow-2xl"
                  style={{ backgroundColor: product.defaultColor }}
                >
                  {frontElement && (
                    <span
                      className="px-2 text-center text-xs font-extrabold tracking-wider"
                      style={{
                        color: frontElement.textColor || '#FFFFFF',
                        fontFamily: frontElement.fontFamily,
                      }}
                    >
                      {frontElement.text}
                    </span>
                  )}
                </div>

                <span className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-2.5 py-1 text-xs font-bold text-amber-400 backdrop-blur">
                  {product.price.toFixed(2)} €
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3 className="font-bold text-white">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                    {product.description}
                  </p>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenProduct(product)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-800 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
                  >
                    <Eye className="h-3.5 w-3.5 text-amber-400" />
                    Page Produit 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => onCustomizeProduct(product)}
                    title="Ouvrir dans le configurateur 3D"
                    className="inline-flex items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
