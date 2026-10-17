import React, { useEffect, useState } from 'react'
import {
  Download,
  FileCode2,
  Image as ImageIcon,
  Lock,
  LogOut,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  fetchAllOrders,
  getAdminSession,
  isConvexConfigured,
  signInAdmin,
  signOutAdmin,
  updateOrderStatus,
} from '../../services/convexClient'
import type { OrderRecord, OrderStatus } from '../../types/configurator'

const ORDER_STATUSES: Array<OrderStatus> = [
  'reçue',
  'en production',
  'expédiée',
  'livrée',
]

const STATUS_BADGE_STYLES: Record<OrderStatus, string> = {
  reçue: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'en production': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  expédiée: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  livrée: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

/**
 * Déclenche le téléchargement direct d'une image (DataURL ou URL Convex Storage) ou d'un fichier JSON
 */
function triggerDownload(urlOrData: string, filename: string) {
  const link = document.createElement('a')
  link.href = urlOrData
  link.download = filename
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function downloadOrderProductionJson(order: OrderRecord) {
  const blob = new Blob([JSON.stringify(order, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `commande-${order.id.slice(0, 8)}-production.json`)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function AdminDashboard() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('admin@fasodesign.com')
  const [passwordInput, setPasswordInput] = useState('Admin3D!2026')
  const [authError, setAuthError] = useState<string | null>(null)
  const [orders, setOrders] = useState<Array<OrderRecord>>([])
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'toutes'>('toutes')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    getAdminSession().then((session) => {
      if (session) {
        setAdminEmail(session.email)
        loadOrders()
      }
    })
  }, [])

  const loadOrders = async () => {
    setIsLoading(true)
    try {
      const list = await fetchAllOrders()
      setOrders(list)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    const res = await signInAdmin(emailInput, passwordInput)
    if (!res.success) {
      setAuthError(res.error || 'Authentification refusée')
      return
    }
    setAdminEmail(res.email || emailInput)
    await loadOrders()
  }

  const handleLogout = async () => {
    await signOutAdmin()
    setAdminEmail(null)
  }

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatus(orderId, newStatus)
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    )
  }

  // ÉCRAN DE CONNEXION ADMIN PROTÉGÉ
  if (!adminEmail) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Administration Atelier 3D
            </h2>
            <p className="text-xs text-zinc-400">
              Accès protégé aux fichiers de production & commandes Convex
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Email administrateur
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          {authError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {authError}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
          >
            Se connecter au panneau vendeur
          </button>

          <p className="text-center text-[11px] text-zinc-500">
            Identifiants par défaut :{' '}
            <code className="text-zinc-300">admin@fasodesign.com</code> /{' '}
            <code className="text-zinc-300">Admin3D!2026</code>
          </p>
        </form>
      </div>
    )
  }

  const filteredOrders =
    statusFilter === 'toutes'
      ? orders
      : orders.filter((o) => o.status === statusFilter)

  return (
    <div className="space-y-6">
      {/* Barre supérieure de l'administration */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">
                Portail Vendeur & Production
              </h2>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                {isConvexConfigured
                  ? 'Convex Cloud Connecté'
                  : 'Convex Mode Local Actif'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Connecté en tant que{' '}
              <span className="font-semibold text-zinc-200">{adminEmail}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Filtres par statut */}
      <div className="flex flex-wrap items-center gap-2">
        {(['toutes', ...ORDER_STATUSES] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
              statusFilter === st
                ? 'border-amber-500 bg-amber-500 text-zinc-950'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Liste des commandes */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-zinc-600" />
          <p className="text-sm font-semibold text-zinc-300">
            Aucune commande pour ce statut
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Passez une commande test depuis le configurateur 3D pour voir
            apparaître tous les fichiers d&apos;impression ici.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl"
            >
              {/* En-tête de commande */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-amber-400">
                      #{order.id.slice(0, 12)}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_BADGE_STYLES[order.status]
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      Stripe: {order.stripeSessionId}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Client :{' '}
                    <strong className="text-zinc-200">
                      {order.shipping.fullName}
                    </strong>{' '}
                    ({order.shipping.email}) • Livraison :{' '}
                    {order.shipping.addressLine}, {order.shipping.postalCode}{' '}
                    {order.shipping.city}, {order.shipping.country}
                  </p>
                </div>

                {/* Changement de statut et export JSON complet */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={order.status}
                    onChange={(e) =>
                      handleStatusChange(order.id, e.target.value as OrderStatus)
                    }
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white focus:border-amber-500 focus:outline-none"
                  >
                    {ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        Statut : {st}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => downloadOrderProductionJson(order)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500 hover:text-amber-300"
                  >
                    <FileCode2 className="h-3.5 w-3.5 text-amber-400" />
                    Fiche JSON
                  </button>
                </div>
              </div>

              {/* Détail des articles de la commande */}
              <div className="mt-4 space-y-4">
                {order.items.map((item, idx) => (
                  <div
                    key={`${order.id}-item-${idx}`}
                    className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 lg:grid-cols-12"
                  >
                    {/* Aperçus PNG 3D Devant et Dos avec téléchargement direct */}
                    <div className="flex gap-3 lg:col-span-5">
                      <div className="flex-1 space-y-1.5">
                        <span className="block text-[11px] font-semibold text-zinc-400">
                          Rendu 3D Devant (PNG)
                        </span>
                        {item.frontPreviewUrl ? (
                          <img
                            src={item.frontPreviewUrl}
                            alt="Rendu Devant"
                            className="h-36 w-full rounded-lg border border-zinc-800 bg-zinc-900 object-contain"
                          />
                        ) : (
                          <div className="flex h-36 items-center justify-center rounded-lg border border-zinc-800 text-xs text-zinc-600">
                            Aperçu non disponible
                          </div>
                        )}
                        {item.frontPreviewUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              triggerDownload(
                                item.frontPreviewUrl,
                                `commande-${order.id.slice(0, 6)}-devant.png`
                              )
                            }
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-800 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700"
                          >
                            <Download className="h-3 w-3 text-amber-400" />
                            Télécharger PNG Devant
                          </button>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <span className="block text-[11px] font-semibold text-zinc-400">
                          Rendu 3D Dos (PNG)
                        </span>
                        {item.backPreviewUrl ? (
                          <img
                            src={item.backPreviewUrl}
                            alt="Rendu Dos"
                            className="h-36 w-full rounded-lg border border-zinc-800 bg-zinc-900 object-contain"
                          />
                        ) : (
                          <div className="flex h-36 items-center justify-center rounded-lg border border-zinc-800 text-xs text-zinc-600">
                            Aperçu non disponible
                          </div>
                        )}
                        {item.backPreviewUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              triggerDownload(
                                item.backPreviewUrl,
                                `commande-${order.id.slice(0, 6)}-dos.png`
                              )
                            }
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-800 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700"
                          >
                            <Download className="h-3 w-3 text-amber-400" />
                            Télécharger PNG Dos
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Spécifications techniques (Couleur, Taille, Textes, Coordonnées 3D, Images HD originales) */}
                    <div className="space-y-3 lg:col-span-7">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 rounded-full border border-white/20"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm font-bold text-white">
                            {item.productName}
                          </span>
                          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-amber-400">
                            Taille {item.size}
                          </span>
                          <span className="font-mono text-xs text-zinc-400">
                            Couleur {item.color}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-zinc-300">
                          Qté : {item.quantity} × {item.unitPrice.toFixed(2)} €
                        </span>
                      </div>

                      <div className="space-y-2">
                        <span className="block text-xs font-semibold text-zinc-400">
                          Éléments de personnalisation ({item.elements.length}) :
                        </span>

                        {item.elements.map((el) => (
                          <div
                            key={el.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/90 p-2.5 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                                  {el.side === 'front' ? 'Devant' : 'Dos'} •{' '}
                                  {el.type}
                                </span>
                                {el.type === 'text' ? (
                                  <span className="font-semibold text-white">
                                    « {el.text} » ({el.fontFamily?.split(',')[0]}
                                    , {el.fontSize}px, texte {el.textColor},
                                    contour {el.strokeColor} {el.strokeWidth}px)
                                  </span>
                                ) : (
                                  <span className="font-semibold text-white">
                                    Fichier : {el.originalFileName || 'image-hd.png'}
                                  </span>
                                )}
                              </div>

                              <p className="font-mono text-[11px] text-zinc-400">
                                Position 3D: [X: {el.position[0]?.toFixed(3)}, Y:{' '}
                                {el.position[1]?.toFixed(3)}] | Échelle:{' '}
                                {Math.round(el.scale * 100)}% | Rotation:{' '}
                                {Math.round((el.rotation * 180) / Math.PI)}°
                              </p>
                            </div>

                            {el.type === 'image' && el.originalImageUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  triggerDownload(
                                    el.originalImageUrl!,
                                    el.originalFileName ||
                                      `image-hd-${el.id}.png`
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                              >
                                <ImageIcon className="h-3.5 w-3.5" />
                                Télécharger Image HD
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
