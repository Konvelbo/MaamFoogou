import React, { useEffect, useState } from 'react'
import { Mail, Lock, Phone, MapPin, User, X } from 'lucide-react'
import { useSignIn, useSignUp, useUser } from '@clerk/clerk-react'
import {
  type PendingProtectedAction,
  authenticateUser,
  closeAuthModal,
  getStoredReferralCode,
  loginWithClerkUser,
  showToast,
  useMaamfoogouStore,
} from '../../services/maamfoogouStore'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ''

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

function ClerkGoogleButton({
  mode = 'login',
  onActionResumed,
}: {
  mode?: 'login' | 'register'
  onActionResumed?: (action: PendingProtectedAction) => void
}) {
  const { signIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, isLoaded: signUpLoaded } = useSignUp()
  const { user } = useUser()

  useEffect(() => {
    if (user && user.primaryEmailAddress) {
      loginWithClerkUser({
        clerkUserId: user.id,
        email: user.primaryEmailAddress.emailAddress,
        name: user.fullName || user.firstName || 'Membre Google',
        avatarUrl: user.imageUrl,
      }).then((res) => {
        if (res.resumedAction && onActionResumed) {
          onActionResumed(res.resumedAction)
        }
      })
    }
  }, [user, onActionResumed])

  const handleSignInGoogle = async () => {
    const redirectUrl = window.location.href
    const redirectUrlComplete = window.location.href
    try {
      if (mode === 'register' && signUpLoaded && signUp) {
        await signUp.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl,
          redirectUrlComplete,
        })
      } else if (signInLoaded && signIn) {
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl,
          redirectUrlComplete,
        })
      }
    } catch (err: any) {
      console.warn('Tentative alternative Clerk OAuth:', err)
      try {
        if (signInLoaded && signIn) {
          await signIn.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl,
            redirectUrlComplete,
          })
          return
        }
      } catch (fallbackErr: any) {
        console.error('Erreur Clerk Google:', fallbackErr)
        showToast(fallbackErr.message || 'Erreur connexion Google avec Clerk', 'error')
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignInGoogle}
      className="w-full h-11 border border-[#CCCCCC] hover:border-[#111111] bg-white text-[#111111] text-xs font-semibold uppercase tracking-wider rounded-none flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
    >
      <GoogleIcon />
      <span>{mode === 'register' ? 'S’inscrire avec Google (Clerk)' : 'Continuer avec Google (Clerk)'}</span>
    </button>
  )
}

function FallbackGoogleButton({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  return (
    <button
      type="button"
      onClick={() => {
        showToast(
          'Authentification Clerk prête. Renseignez votre VITE_CLERK_PUBLISHABLE_KEY dans .env.local pour activer la redirection Google.',
          'info'
        )
      }}
      className="w-full h-11 border border-[#CCCCCC] hover:border-[#111111] bg-white text-[#111111] text-xs font-semibold uppercase tracking-wider rounded-none flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
      title="Nécessite la clé VITE_CLERK_PUBLISHABLE_KEY"
    >
      <GoogleIcon />
      <span>{mode === 'register' ? 'S’inscrire avec Google (Clerk)' : 'Continuer avec Google (Clerk)'}</span>
    </button>
  )
}

interface AuthModalProps {
  onActionResumed?: (action: PendingProtectedAction) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ onActionResumed }) => {
  const state = useMaamfoogouStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+226 70 ')
  const [city, setCity] = useState('Ouagadougou')
  const [district, setDistrict] = useState('Patte d’Oie / Secteur 15')
  const [error, setError] = useState<string | null>(null)

  if (!state.authModalOpen) return null

  const storedRef = getStoredReferralCode()

  const getPendingActionMessage = (action: PendingProtectedAction | null) => {
    if (!action) return null
    switch (action.type) {
      case 'like':
        return 'Connectez-vous pour liker ce modèle : il sera automatiquement sauvegardé dans « Mes collections ».'
      case 'save_design':
        return 'Connectez-vous pour sauvegarder votre création 3D.'
      case 'buy_now':
        return 'Connectez-vous pour finaliser votre commande.'
      case 'open_route':
        return 'Connectez-vous pour accéder à votre espace personnel.'
    }
  }

  const pendingBanner = getPendingActionMessage(state.pendingAction)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'register') {
      if (password.length < 4) {
        setError('Le mot de passe doit contenir au moins 4 caractères.')
        return
      }
      if (password !== confirmPassword) {
        setError(
          'Les mots de passe ne correspondent pas. Veuillez vérifier la confirmation du mot de passe.'
        )
        return
      }
    }

    const result = authenticateUser({
      mode,
      email,
      password,
      name,
      phone,
      city,
      district,
    })

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue.')
      return
    }

    if (result.resumedAction && onActionResumed) {
      onActionResumed(result.resumedAction)
    }
  }

  const handleQuickDemoLogin = (demoEmail: string, demoPass: string) => {
    setError(null)
    const result = authenticateUser({
      mode: 'login',
      email: demoEmail,
      password: demoPass,
    })
    if (result.success && result.resumedAction && onActionResumed) {
      onActionResumed(result.resumedAction)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="relative w-full max-w-[460px] space-y-3 my-8">
        {/* Bloc principal style BZB strict (fond blanc, bordure fine #E5E5E5, 0px border-radius) */}
        <div className="relative bg-white border border-[#111111] rounded-none p-6 sm:p-8">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-1.5 text-[#666666] hover:text-[#111111] rounded-none transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center space-y-1.5 mb-6">
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-[0.08em] text-[#111111]">
              {mode === 'login' ? 'Connexion' : 'Création de compte'}
            </h2>
            <p className="text-xs text-[#666666]">
              Accédez à vos collections, votre Studio 3D et vos avantages XP
            </p>
          </div>

          {pendingBanner && (
            <div className="mb-4 p-3 bg-[#F5F5F5] border border-[#E5E5E5] rounded-none text-xs text-[#111111]">
              {pendingBanner}
            </div>
          )}

          {storedRef && (
            <div className="mb-4 p-2.5 bg-[#F5F5F5] border border-[#E5E5E5] rounded-none text-xs text-[#111111] text-center">
              Code parrainage actif :{' '}
              <strong className="font-mono">{storedRef}</strong>
            </div>
          )}

          {/* Connexion Google avec Clerk */}
          <div className="mb-5">
            {CLERK_PUBLISHABLE_KEY ? (
              <ClerkGoogleButton mode={mode} onActionResumed={onActionResumed} />
            ) : (
              <FallbackGoogleButton mode={mode} />
            )}

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E5E5]" />
              </div>
              <span className="relative bg-white px-2.5 text-[10px] uppercase tracking-wider text-[#757575]">
                Ou avec vos identifiants
              </span>
            </div>
          </div>

          {/* Sélecteur sobre Connexion / Création avec soulignement */}
          <div className="flex border-b border-[#E5E5E5] mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
              }}
              className={`flex-1 pb-2.5 text-xs uppercase tracking-wider transition-colors border-b-2 -mb-[1px] ${
                mode === 'login'
                  ? 'border-[#111111] text-[#111111] font-bold'
                  : 'border-transparent text-[#666666] hover:text-[#111111]'
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError(null)
              }}
              className={`flex-1 pb-2.5 text-xs uppercase tracking-wider transition-colors border-b-2 -mb-[1px] ${
                mode === 'register'
                  ? 'border-[#111111] text-[#111111] font-bold'
                  : 'border-transparent text-[#666666] hover:text-[#111111]'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-none"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div className="relative">
                  <User className="w-4 h-4 text-[#757575] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom complet"
                    className="w-full h-10 pl-9 pr-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#757575] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+226 70 12 34 56"
                      className="w-full h-10 pl-8 pr-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-[#757575] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ville (Ouaga, Bobo...)"
                      className="w-full h-10 pl-8 pr-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Quartier / Secteur de livraison"
                  className="w-full h-10 px-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
                />
              </>
            )}

            <div className="relative">
              <Mail className="w-4 h-4 text-[#757575] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse e-mail"
                className="w-full h-10 pl-9 pr-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-[#757575] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full h-10 pl-9 pr-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
              />
            </div>

            {mode === 'register' && (
              <div className="relative">
                <Lock className="w-4 h-4 text-[#757575] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  aria-label="Confirmer le mot de passe"
                  className="w-full h-10 pl-9 pr-3 text-xs border border-[#CCCCCC] rounded-none focus:outline-none focus:border-[#111111]"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full h-11 bg-[#111111] hover:bg-[#2A2A2A] text-white text-xs font-bold uppercase tracking-wider rounded-none transition-colors"
            >
              {mode === 'login' ? 'Se connecter' : 'Créer mon compte (+50 XP)'}
            </button>
          </form>

          <p className="mt-3 text-center text-[11px] text-[#757575]">
            Votre action en cours reprendra automatiquement après connexion
          </p>
        </div>

        {/* Second bloc BZB "Ou continuer avec" (0px border-radius) */}
        <div className="bg-white border border-[#E5E5E5] rounded-none p-5 text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
            Accès rapide — Comptes de démonstration
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() =>
                handleQuickDemoLogin('idrissa@createur.bf', 'Creator!2026')
              }
              className="py-2.5 px-3 text-xs font-medium border border-[#CCCCCC] hover:border-[#111111] hover:bg-[#111111] hover:text-white rounded-none text-[#111111] transition-colors"
            >
              Idrissa (Créateur)
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickDemoLogin('fiatechnologiecam@gmail.com', 'Admin3D!2026')
              }
              className="py-2.5 px-3 text-xs font-medium border border-[#CCCCCC] hover:border-[#111111] hover:bg-[#111111] hover:text-white rounded-none text-[#111111] transition-colors"
            >
              Maamfoogou (Admin)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

