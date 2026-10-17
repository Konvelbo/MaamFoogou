import React, { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Heart,
  Lock,
  PackageCheck,
  XCircle,
} from 'lucide-react'
import {
  type MaamfoogouDesign,
  checkVariantStockServer,
  getUserXpSummary,
  openAuthForProtectedAction,
  toggleDesignLike,
  updateUserProfile,
  useMaamfoogouStore,
} from '../../services/maamfoogouStore'
import { Card3DCanvas } from './Card3DCanvas'
import { normalizedTo3DElements } from '../../utils/designElementMapper'
import type { TShirtSize } from '../../types/configurator'

interface CollectionsAndSettingsViewProps {
  mode: 'collections' | 'settings'
  onSelectDesign: (designId: string) => void
  onEditDesignIn3D: (design: MaamfoogouDesign) => void
}

export const CollectionsAndSettingsView: React.FC<
  CollectionsAndSettingsViewProps
> = ({ mode, onSelectDesign, onEditDesignIn3D }) => {
  const state = useMaamfoogouStore()
  const currentUser = state.users.find((u) => u.id === state.currentUserId)

  const [name, setName] = useState(currentUser?.name || '')
  const [phone, setPhone] = useState(currentUser?.phone || '')
  const [city, setCity] = useState(
    currentUser?.geoCoordinates.city || 'Ouagadougou'
  )
  const [district, setDistrict] = useState(
    currentUser?.geoCoordinates.district || ''
  )
  const [landmark, setLandmark] = useState(
    currentUser?.geoCoordinates.landmark || ''
  )
  const [copiedRef, setCopiedRef] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-none bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-[#111111]" />
        </div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.06em] text-[#111111]">
          {mode === 'collections'
            ? 'Mes Collections'
            : 'Profil, Niveau XP & Paramètres'}
        </h1>
        <p className="text-xs text-[#666666]">
          Connectez-vous pour accéder à vos modèles créés, vos favoris « À
          acheter plus tard » et votre progression XP.
        </p>
        <button
          type="button"
          onClick={() =>
            openAuthForProtectedAction({
              type: 'open_route',
              route: mode === 'collections' ? '/collections' : '/settings',
            })
          }
          className="px-6 h-10 bg-[#111111] text-white text-xs font-semibold uppercase tracking-[0.06em] rounded-none hover:bg-[#333333] transition-colors"
        >
          Se connecter / Créer un compte
        </button>
      </div>
    )
  }

  // ============================================================================
  // MODE 1 : MES COLLECTIONS (Section 1 : Modèles créés ; Section 2 : Sauvegardés via Likes)
  // ============================================================================
  if (mode === 'collections') {
    const myCreatedDesigns = state.designs.filter(
      (d) => d.ownerId === currentUser.id
    )
    const myLikes = state.likes.filter((l) => l.userId === currentUser.id)
    const savedLikedDesigns = myLikes
      .map((l) => state.designs.find((d) => d.id === l.designId))
      .filter((d): d is MaamfoogouDesign => Boolean(d))

    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-12">
        <div className="border-b border-[#E5E5E5] pb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold uppercase tracking-[0.04em] text-[#111111]">
            Mes Collections
          </h1>
          <span className="text-xs text-[#666666]">
            {myCreatedDesigns.length} création(s) • {savedLikedDesigns.length}{' '}
            sauvegardé(s)
          </span>
        </div>

        {/* SECTION 1 : Modèles créés par l'utilisateur */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111]">
            1. Modèles créés par moi ({myCreatedDesigns.length})
          </h2>

          {myCreatedDesigns.length === 0 ? (
            <div className="p-8 border border-[#E5E5E5] rounded-none text-center text-xs text-[#666666]">
              Vous n’avez pas encore sauvegardé de design personnalisé.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {myCreatedDesigns.map((d) => (
                <div key={d.id} className="flex flex-col bg-white">
                  <div className="aspect-[3/4] bg-[#EBEBEB] rounded-none relative overflow-hidden">
                    <Card3DCanvas
                      color={d.tshirtColor}
                      size={(d.size as TShirtSize) || 'L'}
                      activeSide="front"
                      isVisible={true}
                      elements={normalizedTo3DElements(d.elements)}
                    />
                    <span className="pointer-events-none absolute top-3 left-3 z-10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[#111111] text-white rounded-none">
                      {d.status === 'published' ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>

                  <div className="pt-2.5 space-y-2">
                    <div>
                      <h3 className="text-[13px] font-normal text-[#111111] truncate">
                        {d.name}
                      </h3>
                      <p className="text-[11px] text-[#757575]">
                        Taille {d.size} • {d.price.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onEditDesignIn3D(d)}
                        className="h-8 border border-[#111111] text-[#111111] text-[11px] font-medium uppercase tracking-[0.04em] rounded-none hover:bg-[#F5F5F5] transition-colors"
                      >
                        Recharger 3D
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectDesign(d.id)}
                        className="h-8 bg-[#111111] text-white text-[11px] font-medium uppercase tracking-[0.04em] rounded-none hover:bg-[#333333] transition-colors"
                      >
                        Voir fiche
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2 : Produits sauvegardés "À acheter plus tard" (alimentée automatiquement par les likes) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111]">
              2. Produits sauvegardés « À acheter plus tard » (
              {savedLikedDesigns.length})
            </h2>
            <p className="text-xs text-[#666666] mt-0.5">
              Alimentée automatiquement par vos likes. Retirer le cœur retire le
              modèle de cette liste.
            </p>
          </div>

          {savedLikedDesigns.length === 0 ? (
            <div className="p-8 border border-[#E5E5E5] rounded-none text-center text-xs text-[#666666]">
              Aucun modèle sauvegardé. Cliquez sur le cœur d’un t-shirt pour
              l’ajouter ici.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {savedLikedDesigns.map((d) => {
                const stockStatus = checkVariantStockServer(
                  d.tshirtColor,
                  d.size,
                  1
                )

                return (
                  <div key={d.id} className="flex flex-col bg-white">
                    <div className="aspect-[3/4] bg-[#EBEBEB] rounded-none relative overflow-hidden">
                      <Card3DCanvas
                        color={d.tshirtColor}
                        size={(d.size as TShirtSize) || 'L'}
                        activeSide="front"
                        isVisible={true}
                        elements={normalizedTo3DElements(d.elements)}
                      />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDesignLike(d.id)
                        }}
                        title="Retirer le like et supprimer de la collection"
                        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-none bg-[#111111] text-white flex items-center justify-center"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </div>

                    <div className="pt-2.5 space-y-2">
                      <div>
                        <h3 className="text-[13px] font-normal text-[#111111] truncate">
                          {d.name}
                        </h3>
                        <p className="text-[11px] text-[#757575]">
                          {d.price.toLocaleString('fr-FR')} FCFA • Taille {d.size}
                        </p>
                      </div>

                      {/* Statut de stock en direct (obligatoire Section 5) */}
                      {stockStatus.status === 'available' && (
                        <div className="px-2.5 py-1 rounded-none bg-[#F7F7F7] border border-[#E5E5E5] text-[#111111] text-[11px] flex items-center gap-1.5">
                          <PackageCheck className="w-3.5 h-3.5 text-[#111111]" />
                          En stock ({stockStatus.available} dispo)
                        </div>
                      )}

                      {stockStatus.status === 'low' && (
                        <div className="px-2.5 py-1 rounded-none bg-[#F7F7F7] border border-[#111111] text-[#111111] text-[11px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#111111]" />
                          {stockStatus.message}
                        </div>
                      )}

                      {(stockStatus.status === 'out_of_stock' ||
                        stockStatus.status === 'unavailable') && (
                        <div className="px-2.5 py-1 rounded-none bg-[#FFF5F5] border border-[#D32F2F] text-[#D32F2F] text-[11px] flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-[#D32F2F]" />
                          {stockStatus.message}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectDesign(d.id)}
                        className="w-full h-8 bg-[#111111] text-white text-[11px] font-medium uppercase tracking-[0.04em] rounded-none hover:bg-[#333333] transition-colors"
                      >
                        Voir & Commander
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    )
  }

  // ============================================================================
  // MODE 2 : SETTINGS (Profil, Coordonnées, Niveau 1-100 XP, Parrainage & À propos)
  // ============================================================================
  const xpSummary = getUserXpSummary(currentUser.id)
  const myReferrals = state.referrals.filter(
    (r) => r.referrerId === currentUser.id
  )
  const referralUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${currentUser.referralCode}`
      : `https://maamfoogou.bf/?ref=${currentUser.referralCode}`

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    updateUserProfile({
      name: name || currentUser.name,
      phone: phone || currentUser.phone,
      city: city || currentUser.geoCoordinates.city,
      district: district || currentUser.geoCoordinates.district,
      landmark: landmark || currentUser.geoCoordinates.landmark,
    })
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 3000)
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-10">
      <div className="border-b border-[#E5E5E5] pb-4">
        <h1 className="text-xl font-semibold uppercase tracking-[0.04em] text-[#111111]">
          Profil, Niveau XP (1–100) & À Propos
        </h1>
      </div>

      {/* Bloc Niveau & XP sobre (0px border radius) */}
      <section className="border border-[#E5E5E5] rounded-none p-6 bg-white space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-none bg-[#111111] text-white flex flex-col items-center justify-center">
              <span className="text-[9px] uppercase tracking-wider text-[#BDBDBD]">
                Niveau
              </span>
              <span className="text-xl font-bold">{xpSummary.level}</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111111]">
                {currentUser.name} — {xpSummary.totalXp.toLocaleString('fr-FR')} XP
              </h2>
              <p className="text-xs text-[#666666]">
                Progression vers le niveau {Math.min(100, xpSummary.level + 1)} :{' '}
                {xpSummary.totalXp} / {xpSummary.nextLevelXp} XP (
                {xpSummary.progressPercent}%)
              </p>
            </div>
          </div>
        </div>

        {/* Barre de progression rectangulaire (0px) */}
        <div className="w-full h-2 bg-[#E5E5E5] rounded-none overflow-hidden">
          <div
            className="h-full bg-[#111111] transition-all duration-500"
            style={{ width: `${xpSummary.progressPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Achats', xp: xpSummary.xpByDomain.achats },
            { label: 'Partage', xp: xpSummary.xpByDomain.partage },
            { label: 'Création', xp: xpSummary.xpByDomain.creation },
            { label: 'Communauté', xp: xpSummary.xpByDomain.communaute },
          ].map((dom) => (
            <div
              key={dom.label}
              className="p-3 rounded-none bg-[#F7F7F7] border border-[#E5E5E5]"
            >
              <span className="text-[11px] uppercase tracking-wider text-[#666666] block">
                {dom.label}
              </span>
              <span className="text-sm font-bold text-[#111111]">
                {dom.xp} XP
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {xpSummary.unlockedRewards.map((rw) => (
            <div
              key={rw.id}
              className={`p-3 rounded-none border text-xs ${
                rw.unlocked
                  ? 'border-[#111111] bg-[#FAFAFA] text-[#111111]'
                  : 'border-[#E5E5E5] text-[#757575]'
              }`}
            >
              <div className="flex items-center justify-between font-semibold mb-1">
                <span>{rw.title}</span>
                {rw.unlocked ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#111111]" />
                ) : (
                  <span className="text-[10px]">
                    {rw.currentDomainXp}/{rw.requiredDomainXp} XP
                  </span>
                )}
              </div>
              <p className="text-[11px]">{rw.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulaire Profil & Coordonnées */}
        <div className="lg:col-span-6 border border-[#E5E5E5] rounded-none p-6 bg-white space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111]">
            Coordonnées & Téléphone Mobile Money
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#666666] mb-1">
                Nom complet
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#666666] mb-1">
                Téléphone (Orange Money / Moov Money / Wave)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#666666] mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 px-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#666666] mb-1">
                  Quartier / Secteur
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full h-10 px-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#666666] mb-1">
                Point de repère géographique
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full h-10 px-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 bg-[#111111] hover:bg-[#333333] text-white text-xs font-semibold uppercase tracking-[0.08em] rounded-none transition-colors"
            >
              {savedNotice ? 'Coordonnées enregistrées ✓' : 'Enregistrer'}
            </button>
          </form>
        </div>

        {/* Parrainage & À propos de nous */}
        <div className="lg:col-span-6 space-y-6">
          <div className="border border-[#E5E5E5] rounded-none p-6 bg-white space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111]">
              Parrainage d’amis (+250 XP au 1er achat du filleul)
            </h2>
            <p className="text-xs text-[#666666]">
              Lien personnel conservé 30 jours en cookie/localStorage :
            </p>
            <div className="p-2.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-none flex items-center justify-between gap-2">
              <code className="text-xs text-[#111111] truncate">
                {referralUrl}
              </code>
              <button
                type="button"
                onClick={() => {
                  setCopiedRef(true)
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(referralUrl).catch(() => {})
                  }
                }}
                className="px-3 h-8 bg-[#111111] text-white text-xs rounded-none shrink-0 flex items-center gap-1"
              >
                {copiedRef ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copier
                  </>
                )}
              </button>
            </div>

            {myReferrals.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {myReferrals.map((ref) => (
                  <div
                    key={ref.id}
                    className="p-2 border border-[#E5E5E5] rounded-none flex items-center justify-between text-xs"
                  >
                    <span>{ref.refereeName}</span>
                    <span className="text-[11px] text-[#666666]">
                      {ref.status === 'rewarded'
                        ? '1er achat validé (+250 XP)'
                        : 'Inscrit (attente 1er achat)'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-[#E5E5E5] rounded-none p-6 bg-white space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#111111]">
              À propos de nous — Maamfoogou
            </h2>
            <p className="text-xs text-[#666666] leading-relaxed">
              Basée à Ouagadougou et Bobo-Dioulasso, Maamfoogou conçoit et
              imprime des t-shirts personnalisables en coton peigné du Faso
              (220g/m²), réunissant les collections de notre équipe et les
              créations originales des artistes du Burkina Faso et de la
              sous-région.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
