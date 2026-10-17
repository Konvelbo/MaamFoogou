import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  FileDown,
  Layers,
  Package,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import {
  adminAddStockVariant,
  adminUpdateStockVariant,
  authenticateUser,
  moderateDesignComment,
  runExpirationCronNow,
  triggerMobileMoneyWebhook,
  useMaamfoogouStore,
} from '../../services/maamfoogouStore'
import { Card3DCanvas } from './Card3DCanvas'
import { normalizedTo3DElements } from '../../utils/designElementMapper'
import type { TShirtSize } from '../../types/configurator'

export const AdminStockAndModerationView: React.FC = () => {
  const state = useMaamfoogouStore()
  const currentUser = state.users.find((u) => u.id === state.currentUserId)

  const [activeSubTab, setActiveSubTab] = useState<
    'stock' | 'moderation' | 'production'
  >('stock')
  const [filterColor, setFilterColor] = useState<string>('ALL')
  const [inventoryEditValues, setInventoryEditValues] = useState<
    Record<string, number>
  >({})
  const [restockDates, setRestockDates] = useState<Record<string, string>>({})
  const [addAmounts, setAddAmounts] = useState<Record<string, number>>({})

  // Protection stricte par rôle : réservé aux administrateurs (role === 'admin')
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-none bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7 text-[#111111]" />
        </div>
        <h1 className="text-xl font-bold uppercase tracking-tight text-[#111111]">
          Accès réservé aux administrateurs (/admin/stock)
        </h1>
        <p className="text-xs text-[#666666]">
          Conformément aux principes de sécurité Maamfoogou, toutes les
          mutations d’administration vérifient l’identité et le rôle{' '}
          <code>role === "admin"</code> côté serveur.
        </p>
        <button
          type="button"
          onClick={() =>
            authenticateUser({
              mode: 'login',
              email: 'admin@maamfoogou.bf',
              password: 'Admin2026!',
            })
          }
          className="px-6 py-3 bg-[#111111] hover:bg-[#333333] text-white text-xs font-semibold uppercase tracking-[0.08em] rounded-none inline-flex items-center gap-2 transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-white" />
          Basculer sur le compte Admin Démo (Aminata)
        </button>
      </div>
    )
  }

  // Requête getLowStock : variantes dont le stock disponible (quantity - reserved) <= lowThreshold
  const lowStockRows = state.stock.filter(
    (s) => Math.max(0, s.quantity - s.reserved) <= s.lowThreshold
  )

  const filteredStock =
    filterColor === 'ALL'
      ? state.stock
      : state.stock.filter(
          (s) => s.color.toLowerCase() === filterColor.toLowerCase()
        )

  const reportedOrHiddenComments = state.comments.filter(
    (c) => c.status === 'reported' || c.status === 'hidden'
  )

  const pendingOrdersCount = state.orders.filter(
    (o) => o.status === 'pending'
  ).length

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* En-tête Administration BZB sobre */}
      <div className="bg-[#111111] text-white rounded-none p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BDBDBD] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Administration Maamfoogou • Connecté : {currentUser.name} (admin)
          </span>
          <h1 className="text-lg sm:text-xl font-bold uppercase tracking-[0.04em] mt-1">
            Gestion des Stocks, Modération & Production Imprimeur
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('stock')}
            className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] rounded-none transition-colors ${
              activeSubTab === 'stock'
                ? 'bg-white text-[#111111]'
                : 'bg-[#222222] text-[#CCCCCC] hover:bg-[#333333]'
            }`}
          >
            /admin/stock ({lowStockRows.length} alertes)
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('moderation')}
            className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] rounded-none transition-colors ${
              activeSubTab === 'moderation'
                ? 'bg-white text-[#111111]'
                : 'bg-[#222222] text-[#CCCCCC] hover:bg-[#333333]'
            }`}
          >
            Modération Avis ({reportedOrHiddenComments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('production')}
            className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] rounded-none transition-colors ${
              activeSubTab === 'production'
                ? 'bg-white text-[#111111]'
                : 'bg-[#222222] text-[#CCCCCC] hover:bg-[#333333]'
            }`}
          >
            Commandes & Fiches Imprimeur ({state.orders.length})
          </button>
        </div>
      </div>

      {/* =====================================================================
          ONGLET 1 : /admin/stock (Alertes stock faible, updateStock, addStock, Rupture)
         ===================================================================== */}
      {activeSubTab === 'stock' && (
        <div className="space-y-6">
          {/* 1. Alertes de stock faible en haut de page (getLowStock) */}
          <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-none p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#111111]" />
                Alertes de stock faible & ruptures ({lowStockRows.length}{' '}
                variante(s) sous le seuil)
              </h2>

              <button
                type="button"
                onClick={() => runExpirationCronNow(true)}
                className="px-3 py-1.5 bg-[#111111] text-white text-[11px] font-semibold uppercase tracking-wider rounded-none flex items-center gap-1.5 hover:bg-[#333333]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white" />
                Exécuter Cron Expiration 15 min ({pendingOrdersCount} pending)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {lowStockRows.map((row) => {
                const avail = Math.max(0, row.quantity - row.reserved)
                return (
                  <div
                    key={row.id}
                    className={`p-3 rounded-none border text-xs flex items-center justify-between ${
                      avail === 0
                        ? 'bg-[#FFF5F5] border-[#D32F2F] text-[#D32F2F]'
                        : 'bg-white border-[#111111] text-[#111111]'
                    }`}
                  >
                    <div>
                      <span className="font-bold block">
                        {row.colorName} • Taille {row.size}
                      </span>
                      <span className="text-[11px]">
                        Dispo: <strong>{avail}</strong> (Physique:{' '}
                        {row.quantity}, Réservé: {row.reserved})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        adminAddStockVariant({
                          color: row.color,
                          size: row.size,
                          addedQuantity: 15,
                        })
                      }
                      className="px-2.5 py-1 bg-[#111111] text-white text-[10px] font-semibold uppercase rounded-none shrink-0"
                    >
                      +15 stock
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 2. Filtre par couleur & Tableau complet des variantes */}
          <div className="bg-white border border-[#E5E5E5] rounded-none p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111] flex items-center gap-2">
                <Package className="w-4 h-4 text-[#111111]" />
                Inventaire par Couleur & Taille (updateStock vs addStock)
              </h2>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterColor('ALL')}
                  className={`px-3 py-1 text-xs font-medium uppercase rounded-none border ${
                    filterColor === 'ALL'
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-[#666666] border-[#CCCCCC]'
                  }`}
                >
                  Toutes les couleurs
                </button>
                {Array.from(
                  new Map(
                    state.stock.map((s) => [s.color.toLowerCase(), s.colorName])
                  ).entries()
                ).map(([hex, name]) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setFilterColor(hex)}
                    className={`px-3 py-1 text-xs font-medium rounded-none border flex items-center gap-1.5 ${
                      filterColor === hex
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#666666] border-[#CCCCCC]'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-none border border-[#999999]"
                      style={{ backgroundColor: hex }}
                    />
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-semibold uppercase text-[#666666]">
                    <th className="py-3 px-3">Variante</th>
                    <th className="py-3 px-3">Physique (quantity)</th>
                    <th className="py-3 px-3">Réservé (reserved)</th>
                    <th className="py-3 px-3">Disponible</th>
                    <th className="py-3 px-3">Réappro. (+= n)</th>
                    <th className="py-3 px-3">Correction (updateStock)</th>
                    <th className="py-3 px-3">Rupture & Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {filteredStock.map((row) => {
                    const available = Math.max(0, row.quantity - row.reserved)
                    const addVal = addAmounts[row.id] ?? 10
                    const editVal = inventoryEditValues[row.id] ?? row.quantity
                    const restockVal =
                      restockDates[row.id] ?? row.restockDate ?? '25/11/2026'

                    return (
                      <tr key={row.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-3 px-3 font-semibold text-[#111111]">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-none border border-[#CCCCCC] shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            <span>
                              {row.colorName} — <strong>{row.size}</strong>
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono font-bold">
                          {row.quantity}
                        </td>

                        <td className="py-3 px-3 font-mono">
                          {row.reserved > 0 ? (
                            <span className="px-2 py-0.5 bg-[#F2F2F2] text-[#111111] font-semibold rounded-none">
                              {row.reserved} en cours
                            </span>
                          ) : (
                            <span className="text-[#999999]">0</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 font-semibold rounded-none border ${
                              available === 0
                                ? 'bg-[#FFF5F5] border-[#D32F2F] text-[#D32F2F]'
                                : available <= row.lowThreshold
                                  ? 'bg-[#FAFAFA] border-[#111111] text-[#111111]'
                                  : 'bg-white border-[#E5E5E5] text-[#111111]'
                            }`}
                          >
                            {available} dispo
                          </span>
                        </td>

                        {/* Réapprovisionnement addStock (quantity += n) */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              value={addVal}
                              onChange={(e) =>
                                setAddAmounts((p) => ({
                                  ...p,
                                  [row.id]: Number(e.target.value),
                                }))
                              }
                              className="w-14 px-2 py-1 border border-[#CCCCCC] rounded-none font-mono text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                adminAddStockVariant({
                                  color: row.color,
                                  size: row.size,
                                  addedQuantity: addVal,
                                })
                              }
                              className="px-2.5 py-1 bg-[#111111] hover:bg-[#333333] text-white font-medium rounded-none flex items-center gap-1"
                            >
                              <PlusCircle className="w-3 h-3" />
                              Ajouter
                            </button>
                          </div>
                        </td>

                        {/* Correction d'inventaire updateStock (remplace quantity) */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={editVal}
                              onChange={(e) =>
                                setInventoryEditValues((p) => ({
                                  ...p,
                                  [row.id]: Number(e.target.value),
                                }))
                              }
                              className="w-16 px-2 py-1 border border-[#CCCCCC] rounded-none font-mono text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                adminUpdateStockVariant({
                                  color: row.color,
                                  size: row.size,
                                  quantity: editVal,
                                  restockDate: row.restockDate,
                                })
                              }
                              className="px-2.5 py-1 border border-[#111111] text-[#111111] hover:bg-[#F5F5F5] font-medium rounded-none"
                            >
                              Fixer
                            </button>
                          </div>
                        </td>

                        {/* Bouton rapide "Marquer en rupture" + date de réapprovisionnement */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={restockVal}
                              onChange={(e) =>
                                setRestockDates((p) => ({
                                  ...p,
                                  [row.id]: e.target.value,
                                }))
                              }
                              placeholder="JJ/MM/AAAA"
                              className="w-24 px-2 py-1 border border-[#CCCCCC] rounded-none text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                adminUpdateStockVariant({
                                  color: row.color,
                                  size: row.size,
                                  quantity: 0,
                                  restockDate: restockVal,
                                })
                              }
                              className="px-2.5 py-1 border border-[#D32F2F] text-[#D32F2F] hover:bg-[#FFF5F5] font-medium rounded-none whitespace-nowrap"
                            >
                              Marquer en rupture
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 2 : MODÉRATION DES COMMENTAIRES SIGNALÉS (Section 6)
         ===================================================================== */}
      {activeSubTab === 'moderation' && (
        <div className="bg-white border border-[#E5E5E5] rounded-none p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111]">
            Modération des commentaires signalés ou masqués
          </h2>

          {state.comments.length === 0 ? (
            <p className="text-xs text-[#666666]">Aucun commentaire.</p>
          ) : (
            <div className="divide-y divide-[#E5E5E5]">
              {state.comments.map((c) => {
                const design = state.designs.find((d) => d.id === c.designId)
                return (
                  <div
                    key={c.id}
                    className={`py-4 flex flex-wrap items-center justify-between gap-4 ${
                      c.status === 'reported'
                        ? 'bg-[#FAFAFA] px-3 rounded-none'
                        : c.status === 'hidden'
                          ? 'bg-[#FFF5F5] px-3 rounded-none opacity-70'
                          : ''
                    }`}
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-[#111111]">
                          {c.authorName} (Niv. {c.authorLevel})
                        </span>
                        <span className="text-[#999999]">•</span>
                        <span className="text-[#666666]">
                          Modèle : <strong>{design?.name || c.designId}</strong>
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-none border ${
                            c.status === 'reported'
                              ? 'border-[#111111] bg-white text-[#111111]'
                              : c.status === 'hidden'
                                ? 'border-[#D32F2F] bg-white text-[#D32F2F]'
                                : 'border-[#E5E5E5] bg-[#FAFAFA] text-[#666666]'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#222222]">{c.text}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.status !== 'visible' && (
                        <button
                          type="button"
                          onClick={() => moderateDesignComment(c.id, 'visible')}
                          className="px-3 py-1.5 bg-[#111111] text-white text-xs font-medium rounded-none flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Rendre visible
                        </button>
                      )}
                      {c.status !== 'hidden' && (
                        <button
                          type="button"
                          onClick={() => moderateDesignComment(c.id, 'hidden')}
                          className="px-3 py-1.5 border border-[#D32F2F] text-[#D32F2F] text-xs font-medium rounded-none flex items-center gap-1"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          Masquer (hideComment)
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 3 : FICHES DE PRODUCTION IMPRIMEUR & COMMANDES (Section 7)
         ===================================================================== */}
      {activeSubTab === 'production' && (
        <div className="space-y-4">
          {state.orders.map((ord) => {
            const design = state.designs.find((d) => d.id === ord.designId)
            return (
              <div
                key={ord.id}
                className="bg-white border border-[#E5E5E5] rounded-none p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-3">
                  <div>
                    <span className="text-xs font-mono text-[#666666]">
                      Commande #{ord.id} • Réf Paiement :{' '}
                      {ord.paymentReference}
                    </span>
                    <h3 className="text-sm font-bold uppercase text-[#111111]">
                      {ord.designName} — Taille {ord.size} × {ord.quantity}
                    </h3>
                    <p className="text-xs text-[#666666]">
                      Client : <strong>{ord.deliveryInfo.fullName}</strong> (
                      {ord.deliveryInfo.phone}) — {ord.deliveryInfo.city},{' '}
                      {ord.deliveryInfo.district} ({ord.deliveryInfo.landmark})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-xs font-semibold uppercase rounded-none border ${
                        ord.status === 'paid'
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : ord.status === 'pending'
                            ? 'bg-[#FAFAFA] text-[#111111] border-[#111111]'
                            : 'bg-[#FFF5F5] text-[#D32F2F] border-[#D32F2F]'
                      }`}
                    >
                      {ord.status.toUpperCase()} —{' '}
                      {ord.totalAmount.toLocaleString('fr-FR')} FCFA
                    </span>

                    {ord.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerMobileMoneyWebhook(
                            ord.paymentReference,
                            'SUCCESS'
                          )
                        }
                        className="px-3 py-1.5 bg-[#111111] text-white text-xs font-medium rounded-none"
                      >
                        Simuler Webhook SUCCESS
                      </button>
                    )}
                  </div>
                </div>

                {/* Fiche de production imprimeur (Section 7 : coordonnées 0..1, aperçus Face/Dos, exports printFront/printBack) */}
                {design && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#FAFAFA] p-4 rounded-none border border-[#E5E5E5]">
                    <div className="lg:col-span-4 flex items-center gap-3">
                      <div className="w-24 h-28 bg-white border border-[#E5E5E5] rounded-none overflow-hidden shrink-0">
                        <Card3DCanvas
                          color={ord.color}
                          size={(ord.size || 'L') as TShirtSize}
                          activeSide="front"
                          isVisible={true}
                          elements={normalizedTo3DElements(design.elements)}
                        />
                      </div>
                      <div className="text-xs space-y-1">
                        <span className="font-bold block text-[#111111]">
                          Spécifications Imprimeur
                        </span>
                        <span className="block text-[#666666]">
                          Couleur Hex : <code>{ord.color}</code>
                        </span>
                        <span className="block text-[#666666]">
                          Taille : <strong>{ord.size}</strong>
                        </span>
                        <a
                          href={design.printFrontUrl || design.previewFrontUrl}
                          download={`print_recto_${ord.id}.svg`}
                          className="inline-flex items-center gap-1 text-[#111111] font-semibold underline"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Export plat Recto/Verso
                        </a>
                      </div>
                    </div>

                    <div className="lg:col-span-8">
                      <span className="text-[11px] font-semibold uppercase text-[#666666] flex items-center gap-1 mb-1">
                        <Layers className="w-3.5 h-3.5 text-[#111111]" />
                        Éléments à imprimer (Coordonnées normalisées 0 à 1) :
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {design.elements.map((el) => (
                          <div
                            key={el.id}
                            className="p-2 bg-white border border-[#E5E5E5] rounded-none text-[11px] font-mono"
                          >
                            <strong>[{el.side.toUpperCase()}]</strong>{' '}
                            {el.type.toUpperCase()} « {el.text || 'Image'} » •
                            x={el.x} y={el.y} w={el.width} h={el.height} rot=
                            {el.rotation}°
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
