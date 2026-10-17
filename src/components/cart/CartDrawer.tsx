import React, { useState } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react'
import { processStripeTestPayment } from '../../services/stripeService'
import { saveOrderToBackend } from '../../services/convexClient'
import type {
  CartItem,
  OrderRecord,
  ShippingAddress,
} from '../../types/configurator'

interface CartDrawerProps {
  isOpen: boolean
  items: Array<CartItem>
  onClose: () => void
  onUpdateQuantity: (id: string, delta: number) => void
  onRemoveItem: (id: string) => void
  onClearCart: () => void
  onOrderCreated: (order: OrderRecord) => void
}

export function CartDrawer({
  isOpen,
  items,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderCreated,
}: CartDrawerProps) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart')
  const [rightsConfirmed, setRightsConfirmed] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [createdOrder, setCreatedOrder] = useState<OrderRecord | null>(null)

  const [shipping, setShipping] = useState<ShippingAddress>({
    fullName: 'Amadou Traoré',
    email: 'client@fasodesign.com',
    phone: '+33 6 12 34 56 78',
    addressLine: '24 Rue des Ateliers',
    city: 'Paris',
    postalCode: '75011',
    country: 'France',
  })

  if (!isOpen) return null

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )
  const shippingFee = subtotal > 0 ? 4.9 : 0
  const totalAmount = subtotal + shippingFee

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!rightsConfirmed) {
      setErrorMsg(
        'Vous devez confirmer avoir les droits sur les images personnalisées.'
      )
      return
    }

    setIsProcessing(true)
    try {
      // 1. Paiement Stripe en mode test
      const stripeRes = await processStripeTestPayment({
        amountEur: totalAmount,
        customerEmail: shipping.email,
      })

      if (!stripeRes.success) {
        setErrorMsg(stripeRes.error || 'Échec du paiement Stripe.')
        setIsProcessing(false)
        return
      }

      // 2. Sauvegarde complète dans Convex (images HD originales, textes, coordonnées 3D, aperçus PNG devant/dos)
      const order = await saveOrderToBackend({
        shipping,
        cartItems: items,
        totalAmount,
        stripeSessionId: stripeRes.sessionId,
      })

      setCreatedOrder(order)
      onOrderCreated(order)
      onClearCart()
      setStep('success')
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'enregistrement de la commande."
      )
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        {/* En-tête du tiroir panier */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              {step === 'cart' && `Votre Panier (${items.length})`}
              {step === 'checkout' && 'Livraison & Paiement Stripe (Test)'}
              {step === 'success' && 'Commande Confirmée'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (step === 'success') setStep('cart')
              onClose()
            }}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <ShoppingBag className="mb-3 h-10 w-10 text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-300">
                    Votre panier est vide
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Personnalisez un t-shirt en 3D ou choisissez un modèle du
                    catalogue.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5"
                    >
                      <div className="flex gap-3">
                        {/* Aperçus miniatures 3D Devant et Dos */}
                        <div className="flex gap-1.5">
                          {item.frontPreviewDataUrl ? (
                            <img
                              src={item.frontPreviewDataUrl}
                              alt="Aperçu 3D Devant"
                              className="h-20 w-16 rounded-lg border border-zinc-800 bg-zinc-950 object-cover"
                            />
                          ) : (
                            <div
                              className="h-20 w-16 rounded-lg border border-zinc-800"
                              style={{ backgroundColor: item.color }}
                            />
                          )}
                          {item.backPreviewDataUrl && (
                            <img
                              src={item.backPreviewDataUrl}
                              alt="Aperçu 3D Dos"
                              className="h-20 w-16 rounded-lg border border-zinc-800 bg-zinc-950 object-cover"
                            />
                          )}
                        </div>

                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between">
                              <h3 className="text-sm font-bold text-white">
                                {item.productName}
                              </h3>
                              <button
                                type="button"
                                onClick={() => onRemoveItem(item.id)}
                                className="text-zinc-500 hover:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-white/20"
                                style={{ backgroundColor: item.color }}
                              />
                              <span>Taille {item.size}</span>
                              <span>•</span>
                              <span>{item.elements.length} élément(s)</span>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className="text-zinc-400 hover:text-white"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-xs font-bold">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className="text-zinc-400 hover:text-white"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-amber-400">
                              {(item.unitPrice * item.quantity).toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form
              id="checkout-form"
              onSubmit={handleCheckoutSubmit}
              className="space-y-4"
            >
              <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Adresse de livraison
                </h3>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Nom complet
                  </label>
                  <input
                    required
                    type="text"
                    value={shipping.fullName}
                    onChange={(e) =>
                      setShipping({ ...shipping, fullName: e.target.value })
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Email
                    </label>
                    <input
                      required
                      type="email"
                      value={shipping.email}
                      onChange={(e) =>
                        setShipping({ ...shipping, email: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Téléphone
                    </label>
                    <input
                      required
                      type="tel"
                      value={shipping.phone}
                      onChange={(e) =>
                        setShipping({ ...shipping, phone: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Adresse postale
                  </label>
                  <input
                    required
                    type="text"
                    value={shipping.addressLine}
                    onChange={(e) =>
                      setShipping({ ...shipping, addressLine: e.target.value })
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Code postal
                    </label>
                    <input
                      required
                      type="text"
                      value={shipping.postalCode}
                      onChange={(e) =>
                        setShipping({ ...shipping, postalCode: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Ville
                    </label>
                    <input
                      required
                      type="text"
                      value={shipping.city}
                      onChange={(e) =>
                        setShipping({ ...shipping, city: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Pays
                    </label>
                    <input
                      required
                      type="text"
                      value={shipping.country}
                      onChange={(e) =>
                        setShipping({ ...shipping, country: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bloc Stripe Mode Test */}
              <div className="space-y-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                    <CreditCard className="h-4 w-4" />
                    Paiement sécurisé Stripe (Mode Test)
                  </span>
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-[10px] text-indigo-300">
                    TEST MODE
                  </span>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-300">
                  •••• •••• •••• 4242 &nbsp;|&nbsp; 12/28 &nbsp;|&nbsp; CVC 424
                </div>
              </div>

              {/* Case obligatoire de confirmation des droits */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200">
                <input
                  required
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-amber-500"
                />
                <span>Je confirme avoir les droits sur cette image</span>
              </label>

              {errorMsg && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {errorMsg}
                </div>
              )}
            </form>
          )}

          {step === 'success' && createdOrder && (
            <div className="space-y-4 py-6 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
              <h3 className="text-xl font-bold text-white">
                Merci pour votre commande !
              </h3>
              <p className="text-xs text-zinc-400">
                Les fichiers haute résolution, les coordonnées 3D des décalques
                et les rendus PNG devant/dos ont été transmis à l&apos;atelier
                via Convex.
              </p>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Référence commande :</span>
                  <span className="font-mono font-bold text-amber-400">
                    {createdOrder.id.slice(0, 14)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Session Stripe Test :</span>
                  <span className="font-mono text-zinc-300">
                    {createdOrder.stripeSessionId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Statut initial :</span>
                  <span className="font-semibold text-emerald-400">
                    {createdOrder.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pied du tiroir panier */}
        {step !== 'success' && items.length > 0 && (
          <div className="border-t border-zinc-800 bg-zinc-900/90 p-5 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Sous-total</span>
                <span>{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Livraison suivie</span>
                <span>{shippingFee.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2 text-sm font-bold text-white">
                <span>Total TTC</span>
                <span className="text-amber-400">{totalAmount.toFixed(2)} €</span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
              >
                Passer à la livraison et au paiement
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="rounded-xl border border-zinc-700 px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isProcessing || !rightsConfirmed}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:opacity-45"
                >
                  <Lock className="h-3.5 w-3.5" />
                  {isProcessing
                    ? 'Validation Stripe & Envoi Convex...'
                    : `Payer ${totalAmount.toFixed(2)} € (Stripe Test)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
