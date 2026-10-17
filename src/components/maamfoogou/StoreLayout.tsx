import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react'
import {
  clearToast,
  getStoredReferralCode,
  getUserXpSummary,
  logoutUser,
  openAuthForProtectedAction,
  syncFromConvex,
  useMaamfoogouStore,
  type PendingProtectedAction,
} from '../../services/maamfoogouStore'
import { AuthModal } from './AuthModal'

interface StoreLayoutProps {
  children: React.ReactNode
  searchQuery?: string
  onSearchChange?: (val: string) => void
  activeNav?: 'all' | 'team' | 'creator' | 'customize_3d' | 'collections' | 'settings' | 'none'
  onSelectCategory?: (cat: 'all' | 'team' | 'creator') => void
  onOpenCustomizer?: () => void
  onOpenCollections?: () => void
  onOpenSettings?: () => void
}

export const StoreLayout: React.FC<StoreLayoutProps> = ({
  children,
  searchQuery = '',
  onSearchChange,
  activeNav = 'none',
  onSelectCategory,
  onOpenCustomizer,
  onOpenCollections,
  onOpenSettings,
}) => {
  const state = useMaamfoogouStore()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!state.hasSynced && !state.isSyncing) {
      syncFromConvex()
    }
  }, [state.hasSynced, state.isSyncing])

  const currentUser = state.users.find((u) => u.id === state.currentUserId)
  const xpSummary = currentUser ? getUserXpSummary(currentUser.id) : null
  const activeReferralCookie = getStoredReferralCode()

  const likedDesignIdsCount = currentUser
    ? state.likes.filter((l) => l.userId === currentUser.id).length
    : 0

  const handleNavigateProtected = (
    actionType: 'collections' | 'settings',
    targetRoute: string
  ) => {
    if (!state.sessionToken) {
      openAuthForProtectedAction({
        type: 'open_route',
        route: targetRoute,
      })
      return
    }
    if (actionType === 'collections') {
      if (onOpenCollections) onOpenCollections()
      else navigate({ to: '/' })
    } else if (actionType === 'settings') {
      if (onOpenSettings) onOpenSettings()
      else navigate({ to: '/' })
    }
  }

  const handleActionResumed = (action: PendingProtectedAction) => {
    if (action.type === 'open_route') {
      if (action.route === '/collections') {
        if (onOpenCollections) onOpenCollections()
        else navigate({ to: '/' })
      } else if (action.route === '/settings') {
        if (onOpenSettings) onOpenSettings()
        else navigate({ to: '/' })
      } else if (action.designId) {
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

  const navLinkUnderlineClass = (isActive: boolean) =>
    `relative py-1.5 text-[11px] font-medium uppercase tracking-[0.09em] transition-colors duration-200 text-[#111111] after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:bg-current after:transition-all after:duration-250 ${
      isActive ? 'after:w-full font-semibold' : 'after:w-0 hover:after:w-full'
    }`

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111111] font-sans">
      {/* HEADER BZB ÉPURÉ EN 2 LIGNES */}
      <header className="sticky top-0 z-40 bg-white">
        {/* Ligne 1 : Barre supérieure */}
        <div className="border-b border-[#E5E5E5]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
            {/* Bouton menu mobile + Logo géométrique épuré */}
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

              <Link
                to="/"
                className="text-xl sm:text-2xl font-black tracking-[0.1em] text-[#111111] uppercase hover:opacity-80 transition-opacity"
              >
                MAAMFOOGOU
              </Link>
            </div>

            {/* Barre de recherche centrale rectangulaire */}
            <div className="hidden md:flex flex-1 max-w-[460px] mx-6">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="Rechercher un modèle..."
                  className="w-full h-10 pl-3.5 pr-10 text-xs text-[#111111] placeholder-[#757575] bg-white border border-[#999999] rounded-none focus:outline-none focus:border-[#111111] transition-colors"
                />
                <Search className="w-4 h-4 text-[#111111] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Liens utilitaires à droite (Studio 3D | Compte | Panier) */}
            <div className="flex items-center gap-5 text-xs text-[#111111]">
              {activeReferralCookie && (
                <span className="hidden lg:inline-block text-[11px] text-[#666666] border border-[#E5E5E5] px-2 py-0.5 rounded-none">
                  Ref: {activeReferralCookie}
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onOpenCustomizer) onOpenCustomizer()
                  else navigate({ to: '/' })
                }}
                className="hidden sm:inline-block relative py-1 text-xs text-[#111111] after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1px] after:bg-[#111111] after:w-0 hover:after:w-full after:transition-all after:duration-200"
              >
                Studio 3D
              </button>

              {currentUser && xpSummary ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenSettings) onOpenSettings()
                      else navigate({ to: '/' })
                    }}
                    className="relative py-1 text-xs text-[#111111] flex items-center gap-1.5 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1px] after:bg-[#111111] after:w-0 hover:after:w-full after:transition-all after:duration-200"
                  >
                    <User className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline">{currentUser.name}</span>
                    <span className="text-[11px] text-[#666666]">
                      (Niv.{xpSummary.level})
                    </span>
                    <span className="w-1.5 h-1.5 bg-[#E05A2B] rounded-none" />
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
                  <span className="w-1.5 h-1.5 bg-[#E05A2B] rounded-none -mt-2" />
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
                <span>{likedDesignIdsCount}</span>
              </button>
            </div>
          </div>

          {/* Barre de recherche mobile */}
          <div className="md:hidden border-t border-[#E5E5E5] px-4 py-2">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Rechercher un modèle..."
                className="w-full h-9 pl-2 pr-8 text-xs text-[#111111] placeholder-[#757575] bg-white focus:outline-none"
              />
              <Search className="w-4 h-4 text-[#111111] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Ligne 2 : Barre de navigation principale centrée */}
        <nav className="hidden md:flex items-center justify-center gap-8 h-11 border-b border-[#E5E5E5] bg-white px-4">
          <button
            type="button"
            onClick={() => {
              if (onSelectCategory) onSelectCategory('all')
              else navigate({ to: '/' })
            }}
            className={navLinkUnderlineClass(activeNav === 'all')}
          >
            TEE-SHIRTS
          </button>

          <button
            type="button"
            onClick={() => {
              if (onSelectCategory) onSelectCategory('team')
              else navigate({ to: '/' })
            }}
            className={navLinkUnderlineClass(activeNav === 'team')}
          >
            COLLECTION ÉQUIPE
          </button>

          <button
            type="button"
            onClick={() => {
              if (onSelectCategory) onSelectCategory('creator')
              else navigate({ to: '/' })
            }}
            className={navLinkUnderlineClass(activeNav === 'creator')}
          >
            CRÉATEURS DU FASO
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenCustomizer) onOpenCustomizer()
              else navigate({ to: '/' })
            }}
            className={navLinkUnderlineClass(activeNav === 'customize_3d')}
          >
            STUDIO 3D
          </button>

          <button
            type="button"
            onClick={() =>
              handleNavigateProtected('collections', '/collections')
            }
            className={navLinkUnderlineClass(activeNav === 'collections')}
          >
            MES COLLECTIONS
          </button>

          <button
            type="button"
            onClick={() => handleNavigateProtected('settings', '/settings')}
            className={navLinkUnderlineClass(activeNav === 'settings')}
          >
            PROFIL & XP
          </button>
        </nav>

        {/* Menu mobile déroulant */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#E5E5E5] bg-white px-4 py-3 space-y-2">
            {[
              {
                label: 'TEE-SHIRTS (ACCUEIL)',
                action: () => {
                  if (onSelectCategory) onSelectCategory('all')
                  else navigate({ to: '/' })
                },
              },
              {
                label: 'COLLECTION ÉQUIPE',
                action: () => {
                  if (onSelectCategory) onSelectCategory('team')
                  else navigate({ to: '/' })
                },
              },
              {
                label: 'CRÉATEURS DU FASO',
                action: () => {
                  if (onSelectCategory) onSelectCategory('creator')
                  else navigate({ to: '/' })
                },
              },
              {
                label: 'STUDIO 3D',
                action: () => {
                  if (onOpenCustomizer) onOpenCustomizer()
                  else navigate({ to: '/' })
                },
              },
              {
                label: `MES COLLECTIONS (${likedDesignIdsCount})`,
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

      {/* Toast Notification */}
      {state.lastToast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-[#111111] text-white px-4 py-3 rounded-none flex items-center justify-between gap-3 text-xs shadow-lg">
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

      {/* Modale d'authentification */}
      <AuthModal onActionResumed={handleActionResumed} />

      {/* Contenu principal */}
      <main className="flex-1">{children}</main>

      {/* Footer minimaliste style BZB */}
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
            <Link to="/" className="hover:text-[#111111] transition-colors">
              Boutique
            </Link>
            <button
              type="button"
              onClick={() => {
                if (onOpenCustomizer) onOpenCustomizer()
                else navigate({ to: '/' })
              }}
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
