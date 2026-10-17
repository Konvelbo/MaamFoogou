import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpDown,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react'
import {
  FEATURED_DESIGNS_LIMIT,
  type MaamfoogouDesign,
  type PendingProtectedAction,
  clearToast,
  fetchDesignById,
  getStoredReferralCode,
  getUserXpSummary,
  logoutUser,
  openAuthForProtectedAction,
  registerIncomingReferralRef,
  retrySyncFromConvex,
  syncFromConvex,
  useMaamfoogouStore,
} from '../services/maamfoogouStore'
import { FeaturedDesignCard } from '../components/maamfoogou/FeaturedDesignCard'
import { ProductDetailView } from '../components/maamfoogou/ProductDetailView'
import { Design3DIntegrationPlaceholder } from '../components/maamfoogou/Design3DIntegrationPlaceholder'
import { CollectionsAndSettingsView } from '../components/maamfoogou/CollectionsAndSettingsView'
import { AdminStockAndModerationView } from '../components/maamfoogou/AdminStockAndModerationView'
import { AuthModal } from '../components/maamfoogou/AuthModal'

export const Route = createFileRoute('/')({
  component: MaamfoogouBoutiqueApp,
})

type ActivePage =
  | 'home'
  | 'product_detail'
  | 'customize_3d'
  | 'collections'
  | 'settings'
  | 'admin_stock'

function MaamfoogouBoutiqueApp() {
  const state = useMaamfoogouStore()
  const currentUser = state.users.find((u) => u.id === state.currentUserId)

  const [activePage, setActivePage] = useState<ActivePage>('home')
  const [selectedDesignId, setSelectedDesignId] = useState<string>(
    state.designs[0]?.id || 'des_faso_danfani'
  )
  const [designToReloadIn3D, setDesignToReloadIn3D] =
    useState<MaamfoogouDesign | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'team' | 'creator'>(
    'all'
  )
  const [sortBy, setSortBy] = useState<'featured' | 'likes' | 'price_asc'>(
    'featured'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Lecture des paramètres URL (?ref=CODE et ?design=ID) au chargement
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const refParam = params.get('ref')
    const designParam = params.get('design')

    if (refParam) {
      registerIncomingReferralRef(refParam, designParam || undefined)
    }

    if (designParam) {
      const found = state.designs.find((d) => d.id === designParam)
      if (found) {
        setSelectedDesignId(found.id)
        setActivePage('product_detail')
      }
    }

    const customizeParam = params.get('customize')
    if (customizeParam) {
      const found = state.designs.find((d) => d.id === customizeParam)
      if (found) {
        setDesignToReloadIn3D(found)
        setActivePage('customize_3d')
      } else {
        fetchDesignById(customizeParam).then((fetched) => {
          if (fetched) {
            setDesignToReloadIn3D(fetched)
            setActivePage('customize_3d')
          }
        })
      }
    }
  }, [state.designs])

  // Synchronisation Convex au montage de la boutique si non synchronisé
  useEffect(() => {
    if (!state.hasSynced && !state.isSyncing) {
      syncFromConvex()
    }
  }, [state.hasSynced, state.isSyncing])

  // Fermeture automatique du toast après 4s
  useEffect(() => {
    if (!state.lastToast) return
    const timer = setTimeout(() => {
      clearToast()
    }, 4000)
    return () => clearTimeout(timer)
  }, [state.lastToast])

  // Remonter automatiquement en haut de page à chaque changement de vue
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [activePage, selectedDesignId])

  // Catalogue complet filtré & trié (Section 4 : Modèles à découvrir)
  const catalogDesigns = useMemo(() => {
    return state.designs
      .filter((d) => d.status === 'published')
      .filter((d) =>
        sourceFilter === 'all' ? true : d.source === sourceFilter
      )
      .filter((d) => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return (
          d.name.toLowerCase().includes(q) ||
          d.creatorName.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q)
        )
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price
        if (sortBy === 'likes') return b.likesCount - a.likesCount
        if (a.featured !== b.featured) return a.featured ? -1 : 1
        return b.createdAt - a.createdAt
      })
  }, [state.designs, sourceFilter, searchQuery, sortBy])

  const likedDesignIds = useMemo(() => {
    if (!state.currentUserId) return new Set<string>()
    return new Set(
      state.likes
        .filter((l) => l.userId === state.currentUserId)
        .map((l) => l.designId)
    )
  }, [state.likes, state.currentUserId])

  const xpSummary = currentUser ? getUserXpSummary(currentUser.id) : null
  const activeReferralCookie = getStoredReferralCode()

  const navigate = useNavigate()

  const handleOpenProductDetail = (designId: string) => {
    navigate({
      to: '/modeles/$designId',
      params: { designId },
    })
  }

  const handleNavigateProtected = (
    targetPage: 'collections' | 'settings',
    routeLabel: string
  ) => {
    if (!currentUser) {
      openAuthForProtectedAction({
        type: 'open_route',
        route: routeLabel,
      })
      return
    }
    setActivePage(targetPage)
    setMobileMenuOpen(false)
  }

  const handleActionResumed = (action: PendingProtectedAction) => {
    if (action.type === 'open_route') {
      if (action.route === '/collections') setActivePage('collections')
      else if (action.route === '/settings') setActivePage('settings')
      else if (action.designId) {
        navigate({
          to: '/modeles/$designId',
          params: { designId: action.designId },
        })
      }
    } else if (action.type === 'buy_now') {
      navigate({
        to: '/modeles/$designId',
        params: { designId: action.designId },
      })
    }
  }

  const selectedDesign =
    state.designs.find((d) => d.id === selectedDesignId) || state.designs[0]

  // Classe réutilisable pour l'animation de soulignement au survol des boutons de navigation (style BZB)
  const navLinkUnderlineClass = (isActive: boolean, customColor?: string) =>
    `relative py-1.5 text-[11px] font-medium uppercase tracking-[0.09em] transition-colors duration-200 ${
      customColor || 'text-[#111111]'
    } after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:bg-current after:transition-all after:duration-250 ${
      isActive ? 'after:w-full font-semibold' : 'after:w-0 hover:after:w-full'
    }`

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111111] font-sans">
      {/* =====================================================================
          HEADER BZB ÉPURÉ EN 2 LIGNES :
          Ligne 1 : Logo géométrique à gauche | Grande barre de recherche rectangulaire au centre | Liens sobres à droite
          Ligne 2 : Navigation horizontale centrée avec animation de soulignement au hover
         ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white">
        {/* Ligne 1 : Barre supérieure */}
        <div className="border-b border-[#E5E5E5]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
            {/* Bouton menu mobile + Logo géométrique épuré (comme BZB) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="md:hidden p-1.5 text-[#111111] hover:opacity-70"
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActivePage('home')}
                className="text-xl sm:text-2xl font-black tracking-[0.1em] text-[#111111] uppercase hover:opacity-80 transition-opacity"
              >
                MAAMFOOGOU
              </button>
            </div>

            {/* Barre de recherche centrale rectangulaire (exactement comme plp-desktop-1440x900.png : bordure fine, 0px radius) */}
            <div className="hidden md:flex flex-1 max-w-[460px] mx-6">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (activePage !== 'home') setActivePage('home')
                  }}
                  placeholder="Rechercher"
                  className="w-full h-10 pl-3.5 pr-10 text-xs text-[#111111] placeholder-[#757575] bg-white border border-[#999999] rounded-none focus:outline-none focus:border-[#111111] transition-colors"
                />
                <Search className="w-4 h-4 text-[#111111] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Liens utilitaires à droite (style BZB : Magasins | Compte• | Sac 0) */}
            <div className="flex items-center gap-5 text-xs text-[#111111]">
              {activeReferralCookie && (
                <span className="hidden lg:inline-block text-[11px] text-[#666666] border border-[#E5E5E5] px-2 py-0.5 rounded-[4px]">
                  Ref: {activeReferralCookie}
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setDesignToReloadIn3D(null)
                  setActivePage('customize_3d')
                }}
                className="hidden sm:inline-block relative py-1 text-xs text-[#111111] after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1px] after:bg-[#111111] after:w-0 hover:after:w-full after:transition-all after:duration-200"
              >
                Studio 3D
              </button>

              {currentUser && xpSummary ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setActivePage('settings')}
                    className="relative py-1 text-xs text-[#111111] flex items-center gap-1.5 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1px] after:bg-[#111111] after:w-0 hover:after:w-full after:transition-all after:duration-200"
                  >
                    <User className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline">{currentUser.name}</span>
                    <span className="text-[11px] text-[#666666]">
                      (Niv.{xpSummary.level})
                    </span>
                    <span className="w-1.5 h-1.5 bg-[#E05A2B] rounded-[1px]" />
                  </button>

                  <button
                    type="button"
                    onClick={logoutUser}
                    title="Se déconnecter"
                    className="text-[#666666] hover:text-[#111111] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthForProtectedAction(null)}
                  className="relative py-1 text-xs text-[#111111] flex items-center gap-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1px] after:bg-[#111111] after:w-0 hover:after:w-full after:transition-all after:duration-200"
                >
                  <User className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Compte</span>
                  <span className="w-1.5 h-1.5 bg-[#E05A2B] rounded-[1px] -mt-2" />
                </button>
              )}

              <span className="h-4 w-[1px] bg-[#E5E5E5]" />

              <button
                type="button"
                onClick={() =>
                  handleNavigateProtected('collections', '/collections')
                }
                className="flex items-center gap-1.5 text-xs text-[#111111] hover:opacity-70 transition-opacity"
                title="Mes Collections & Produits sauvegardés"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{likedDesignIds.size}</span>
              </button>
            </div>
          </div>

          {/* Barre de recherche mobile (comme plp-mobile-390x844.png) */}
          <div className="md:hidden border-t border-[#E5E5E5] px-4 py-2">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (activePage !== 'home') setActivePage('home')
                }}
                placeholder="Rechercher"
                className="w-full h-9 pl-2 pr-8 text-xs text-[#111111] placeholder-[#757575] bg-white focus:outline-none"
              />
              <Search className="w-4 h-4 text-[#111111] absolute right-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Ligne 2 : Barre de navigation principale centrée avec animation hover (style BZB monochrome) */}
        <nav className="hidden md:flex items-center justify-center gap-8 h-11 border-b border-[#E5E5E5] bg-white px-4">
          <button
            type="button"
            onClick={() => {
              setSourceFilter('all')
              setActivePage('home')
            }}
            className={navLinkUnderlineClass(
              activePage === 'home' && sourceFilter === 'all'
            )}
          >
            TEE-SHIRTS
          </button>

          <button
            type="button"
            onClick={() => {
              setSourceFilter('team')
              setActivePage('home')
            }}
            className={navLinkUnderlineClass(
              activePage === 'home' && sourceFilter === 'team'
            )}
          >
            COLLECTION ÉQUIPE
          </button>

          <button
            type="button"
            onClick={() => {
              setSourceFilter('creator')
              setActivePage('home')
            }}
            className={navLinkUnderlineClass(
              activePage === 'home' && sourceFilter === 'creator'
            )}
          >
            CRÉATEURS DU FASO
          </button>

          <button
            type="button"
            onClick={() => {
              setDesignToReloadIn3D(null)
              setActivePage('customize_3d')
            }}
            className={navLinkUnderlineClass(activePage === 'customize_3d')}
          >
            STUDIO 3D
          </button>

          <button
            type="button"
            onClick={() =>
              handleNavigateProtected('collections', '/collections')
            }
            className={navLinkUnderlineClass(activePage === 'collections')}
          >
            MES COLLECTIONS
          </button>

          <button
            type="button"
            onClick={() => handleNavigateProtected('settings', '/settings')}
            className={navLinkUnderlineClass(activePage === 'settings')}
          >
            PROFIL & XP
          </button>
        </nav>

        {/* Menu déroulant Mobile épuré */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#E5E5E5] bg-white px-4 py-3 space-y-2">
            {[
              {
                label: 'TEE-SHIRTS (ACCUEIL)',
                action: () => {
                  setSourceFilter('all')
                  setActivePage('home')
                },
              },
              {
                label: 'COLLECTION ÉQUIPE',
                action: () => {
                  setSourceFilter('team')
                  setActivePage('home')
                },
              },
              {
                label: 'CRÉATEURS DU FASO',
                action: () => {
                  setSourceFilter('creator')
                  setActivePage('home')
                },
              },
              {
                label: 'STUDIO 3D',
                action: () => {
                  setDesignToReloadIn3D(null)
                  setActivePage('customize_3d')
                },
              },
              {
                label: `MES COLLECTIONS (${likedDesignIds.size})`,
                action: () =>
                  handleNavigateProtected('collections', '/collections'),
              },
              {
                label: 'PROFIL, NIVEAU XP & À PROPOS',
                action: () => handleNavigateProtected('settings', '/settings'),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.action()
                  setMobileMenuOpen(false)
                }}
                className="block w-full py-1.5 text-left text-xs font-medium tracking-wider text-[#111111] hover:underline"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Notification Toast sobre (0px border-radius) */}
      {state.lastToast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-[#111111] text-white px-4 py-3 rounded-none flex items-center justify-between gap-3 text-xs">
          <span>{state.lastToast.text}</span>
          <button
            type="button"
            onClick={clearToast}
            className="text-[#BDBDBD] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modale d'authentification BZB */}
      <AuthModal onActionResumed={handleActionResumed} />

      {/* =====================================================================
          CONTENU PRINCIPAL
         ===================================================================== */}
      <main className="flex-1">
        {activePage === 'home' && (
          <div>
            {/* En-tête de catégorie & sous-navigation inspirés de b-z-b.com/vetement-femme/tee-shirt/ */}
            <div className="border-b border-[#E5E5E5]">
              <div className="max-w-[1360px] mx-auto px-4 sm:px-8 pt-5 pb-6 space-y-4">
                {/* Fil d'ariane */}
                <div className="text-xs text-[#666666] flex items-center gap-1.5">
                  <span>Accueil</span>
                  <span>/</span>
                  <span>Vêtements</span>
                  <span>/</span>
                  <span className="text-[#111111] font-medium">
                    Tee-shirts personnalisables
                  </span>
                </div>

                <h1 className="text-lg sm:text-xl font-bold uppercase tracking-[0.06em] text-[#111111]">
                  Tee-shirts personnalisables & Créateurs
                </h1>

                {/* Onglets horizontaux avec barre noire animée au survol */}
                <div className="flex items-center justify-start sm:justify-center gap-6 overflow-x-auto pt-1 no-scrollbar">
                  {[
                    { id: 'all', label: 'Tous les tee-shirts' },
                    { id: 'team', label: 'Collection Équipe' },
                    { id: 'creator', label: 'Modèles Créateurs' },
                  ].map((tab) => {
                    const isActive = sourceFilter === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() =>
                          setSourceFilter(tab.id as 'all' | 'team' | 'creator')
                        }
                        className={`relative pb-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors duration-200 ${
                          isActive
                            ? 'text-[#111111]'
                            : 'text-[#666666] hover:text-[#111111]'
                        } after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-[#111111] after:transition-all after:duration-200 ${
                          isActive
                            ? 'after:w-full'
                            : 'after:w-0 hover:after:w-full'
                        }`}
                      >
                        {tab.label}
                      </button>
                    )
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setDesignToReloadIn3D(null)
                      setActivePage('customize_3d')
                    }}
                    className="relative pb-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-[#666666] hover:text-[#111111] transition-colors duration-200 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-[#111111] after:w-0 hover:after:w-full after:transition-all after:duration-200"
                  >
                    Studio 3D sur-mesure
                  </button>
                </div>

                {/* Boutons sous-catégories encadrés à angles droits (0px border-radius, style BZB) */}
                <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pt-1 no-scrollbar">
                  {[
                    {
                      label: 'Modèles à découvrir',
                      onClick: () => {
                        setSourceFilter('all')
                        setSearchQuery('')
                        setSortBy('featured')
                      },
                      active: sortBy === 'featured' && sourceFilter === 'all' && !searchQuery.trim(),
                    },
                    {
                      label: 'Les plus likés',
                      onClick: () => setSortBy('likes'),
                      active: sortBy === 'likes',
                    },
                    {
                      label: 'Prix croissant',
                      onClick: () => setSortBy('price_asc'),
                      active: sortBy === 'price_asc',
                    },
                    {
                      label: 'Créer dans le Studio 3D',
                      onClick: () => {
                        setDesignToReloadIn3D(null)
                        setActivePage('customize_3d')
                      },
                      active: false,
                    },
                  ].map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={pill.onClick}
                      className={`px-4 py-2 text-xs rounded-none border whitespace-nowrap transition-colors duration-200 ${
                        pill.active
                          ? 'border-[#111111] bg-[#111111] text-white font-semibold'
                          : 'border-[#CCCCCC] bg-white text-[#111111] hover:border-[#111111]'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-6 space-y-6">
              {/* SECTION 4 : "MODÈLES À DÉCOUVRIR" (Max 5 cartes : grille 2x2 sur mobile, jusqu'à 5 sur desktop) */}
              <section aria-labelledby="featured-heading" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2
                    id="featured-heading"
                    className="text-sm font-semibold text-[#111111] uppercase tracking-wider"
                  >
                    Modèles à découvrir {state.designs.length === 0 && (state.isSyncing || !state.hasSynced) ? '(chargement...)' : `(${Math.min(catalogDesigns.length, FEATURED_DESIGNS_LIMIT)})`}
                  </h2>
                  <span className="text-xs text-[#666666]">
                    Modèles 3D temps réel • Face • Dos • Couleurs
                  </span>
                </div>

                {/* BARRE D'OUTILS BZB ("X articles" | "Trier") */}
                <div className="flex items-center justify-between border-y border-[#E5E5E5] py-3 text-xs text-[#111111]">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceFilter('all')
                      setSearchQuery('')
                    }}
                    className="inline-flex items-center gap-2 hover:opacity-70 transition-opacity"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Réinitialiser les filtres</span>
                  </button>

                  <span id="catalog-heading" className="text-[#666666]">
                    {state.designs.length === 0 && (state.isSyncing || !state.hasSynced)
                      ? 'Synchronisation des modèles 3D...'
                      : `${Math.min(catalogDesigns.length, FEATURED_DESIGNS_LIMIT)} modèles 3D affichés`}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setSortBy((prev) =>
                        prev === 'featured'
                          ? 'likes'
                          : prev === 'likes'
                            ? 'price_asc'
                            : 'featured'
                      )
                    }
                    className="inline-flex items-center gap-1.5 font-medium hover:opacity-70 transition-opacity"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>
                      Trier :{' '}
                      {sortBy === 'featured'
                        ? 'Mis en avant'
                        : sortBy === 'likes'
                          ? 'Popularité'
                          : 'Prix'}
                    </span>
                  </button>
                </div>

                {/* Grille 2x2 sur mobile, jusqu'à 5 sur desktop avec Skeletons BZB et fallback d'erreur */}
                {state.designs.length === 0 && (state.isSyncing || !state.hasSynced) ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 py-2">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`border border-[#E5E5E5] bg-white p-3 space-y-3 animate-pulse ${
                          idx === 4 ? 'hidden lg:block' : ''
                        }`}
                      >
                        <div className="aspect-[3/4] bg-[#F5F5F5] w-full" />
                        <div className="space-y-2 pt-1">
                          <div className="h-3 bg-[#E5E5E5] w-3/4" />
                          <div className="h-2.5 bg-[#EEEEEE] w-1/2" />
                          <div className="h-3.5 bg-[#E5E5E5] w-1/3 pt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : catalogDesigns.length === 0 ? (
                  <div className="border border-[#E5E5E5] bg-[#FAFAFA] p-8 text-center space-y-3 my-4">
                    {state.syncError ? (
                      <>
                        <p className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                          Synchronisation momentanément indisponible
                        </p>
                        <p className="text-[11px] text-[#666666] max-w-sm mx-auto">
                          Impossible de synchroniser le catalogue avec Convex ({state.syncError}).
                        </p>
                        <button
                          type="button"
                          onClick={() => retrySyncFromConvex()}
                          className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white rounded-none hover:opacity-85 transition-opacity"
                        >
                          Réessayer la synchronisation
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                          Aucun modèle ne correspond à vos filtres
                        </p>
                        <p className="text-[11px] text-[#666666]">
                          Essayez de réinitialiser vos critères ou de modifier votre recherche.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSourceFilter('all')
                            setSearchQuery('')
                            setSortBy('featured')
                          }}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-[#111111] bg-white text-[#111111] rounded-none hover:bg-[#111111] hover:text-white transition-colors"
                        >
                          Réinitialiser les filtres
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
                    {catalogDesigns.slice(0, FEATURED_DESIGNS_LIMIT).map((design, idx) => (
                      <div
                        key={design.id}
                        className={idx === 4 ? 'hidden lg:block' : ''}
                      >
                        <FeaturedDesignCard
                          design={design}
                          cardIndex={idx}
                          isLikedByCurrentUser={likedDesignIds.has(design.id)}
                          onSelectDesign={handleOpenProductDetail}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* PAGE 3 : FICHE PRODUIT / MODÈLE */}
        {activePage === 'product_detail' && selectedDesign && (
          <ProductDetailView
            design={selectedDesign}
            onBackToCatalog={() => setActivePage('home')}
            onOpenCustomizerWithDesign={(design) => {
              setDesignToReloadIn3D(design)
              setActivePage('customize_3d')
            }}
          />
        )}

        {/* PAGE 4 : PERSONNALISATION 3D */}
        {activePage === 'customize_3d' && (
          <Design3DIntegrationPlaceholder
            initialDesign={designToReloadIn3D}
            onSavedDesign={(newDesignId) => {
              setSelectedDesignId(newDesignId)
              setActivePage('collections')
            }}
            onBuyDesignNow={(newDesignId) => {
              setSelectedDesignId(newDesignId)
              setActivePage('product_detail')
            }}
          />
        )}

        {/* PAGE 5 : SETTINGS (Profil, Niveau XP & À propos) */}
        {activePage === 'settings' && (
          <CollectionsAndSettingsView
            mode="settings"
            onSelectDesign={handleOpenProductDetail}
            onEditDesignIn3D={(design) => {
              setDesignToReloadIn3D(design)
              setActivePage('customize_3d')
            }}
          />
        )}

        {/* PAGE 6 : MES COLLECTIONS */}
        {activePage === 'collections' && (
          <CollectionsAndSettingsView
            mode="collections"
            onSelectDesign={handleOpenProductDetail}
            onEditDesignIn3D={(design) => {
              setDesignToReloadIn3D(design)
              setActivePage('customize_3d')
            }}
          />
        )}

        {/* PAGE 7 : ADMIN (/admin/stock & Modération) */}
        {activePage === 'admin_stock' && <AdminStockAndModerationView />}
      </main>

      {/* Pied de page minimaliste sur fond blanc */}
      <footer className="border-t border-[#E5E5E5] bg-white mt-16">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-[#666666]">
          <div>
            <strong className="text-[#111111] tracking-wider">
              MAAMFOOGOU
            </strong>{' '}
            — Boutique de t-shirts personnalisables • Ouagadougou, Bobo-Dioulasso
            & Sous-région
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActivePage('home')}
              className="hover:text-[#111111] transition-colors"
            >
              Boutique
            </button>
            <button
              type="button"
              onClick={() => setActivePage('customize_3d')}
              className="hover:text-[#111111] transition-colors"
            >
              Personnalisation 3D
            </button>
            <button
              type="button"
              onClick={() => handleNavigateProtected('settings', '/settings')}
              className="hover:text-[#111111] transition-colors"
            >
              À propos de nous
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
