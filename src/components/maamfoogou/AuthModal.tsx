import React, { useState } from 'react'
import { Mail, Lock, Phone, MapPin, User, X } from 'lucide-react'
import {
  type PendingProtectedAction,
  authenticateUser,
  closeAuthModal,
  getStoredReferralCode,
  useMaamfoogouStore,
} from '../../services/maamfoogouStore'

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
                handleQuickDemoLogin('admin@maamfoogou.bf', 'Admin3D!2026')
              }
              className="py-2.5 px-3 text-xs font-medium border border-[#CCCCCC] hover:border-[#111111] hover:bg-[#111111] hover:text-white rounded-none text-[#111111] transition-colors"
            >
              Admin Atelier
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

