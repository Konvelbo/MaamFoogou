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
        return 'Connectez-vous pour finaliser votre commande Mobile Money.'
      case 'open_route':
        return 'Connectez-vous pour accéder à votre espace personnel.'
    }
  }

  const pendingBanner = getPendingActionMessage(state.pendingAction)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="relative w-full max-w-[460px] space-y-4 my-8">
        {/* Bloc principal inspiré exactement de la page Login BZB (fond blanc, bordure fine #E5E5E5, rounded-[6px]) */}
        <div className="relative bg-white border border-[#E5E5E5] rounded-[6px] p-6 sm:p-8">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-1.5 text-[#666666] hover:text-[#111111] rounded-[4px] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center space-y-1.5 mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-[#111111]">
              Connexion ou création de compte
            </h2>
            <p className="text-xs text-[#666666]">
              Accédez à vos avantages, vos collections et votre suivi de commande
            </p>
          </div>

          {pendingBanner && (
            <div className="mb-4 p-3 bg-[#F7F7F7] border border-[#E5E5E5] rounded-[4px] text-xs text-[#111111]">
              {pendingBanner}
            </div>
          )}

          {storedRef && (
            <div className="mb-4 p-2.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-[4px] text-xs text-[#111111] text-center">
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
              className={`flex-1 pb-2.5 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
                mode === 'login'
                  ? 'border-[#111111] text-[#111111] font-semibold'
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
              className={`flex-1 pb-2.5 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
                mode === 'register'
                  ? 'border-[#111111] text-[#111111] font-semibold'
                  : 'border-transparent text-[#666666] hover:text-[#111111]'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[4px]">
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
                    className="w-full h-10 pl-9 pr-3 text-xs border border-[#CCCCCC] rounded-[4px] focus:outline-none focus:border-[#111111]"
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
                      className="w-full h-10 pl-8 pr-3 text-xs border border-[#CCCCCC] rounded-[4px] focus:outline-none focus:border-[#111111]"
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
                      className="w-full h-10 pl-8 pr-3 text-xs border border-[#CCCCCC] rounded-[4px] focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Quartier / Secteur de livraison"
                  className="w-full h-10 px-3 text-xs border border-[#CCCCCC] rounded-[4px] focus:outline-none focus:border-[#111111]"
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
                className="w-full h-10 pl-9 pr-3 text-xs border border-[#CCCCCC] rounded-[4px] focus:outline-none focus:border-[#111111]"
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
                className="w-full h-10 pl-9 pr-3 text-xs border border-[#CCCCCC] rounded-[4px] focus:outline-none focus:border-[#111111]"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 bg-[#111111] hover:bg-[#333333] text-white text-xs font-medium rounded-[4px] transition-colors"
            >
              {mode === 'login' ? 'Suivant' : 'Créer mon compte (+50 XP)'}
            </button>
          </form>

          <p className="mt-3 text-center text-[11px] text-[#757575]">
            Saisissez votre e-mail, votre action en cours reprendra automatiquement
          </p>
        </div>

        {/* Second bloc BZB "Ou continuer avec" (rounded-[6px]) */}
        <div className="bg-white border border-[#E5E5E5] rounded-[6px] p-5 text-center space-y-3">
          <p className="text-xs font-medium text-[#111111]">
            Ou continuer avec un compte démo
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() =>
                handleQuickDemoLogin('kader@maamfoogou.bf', 'Kader2026!')
              }
              className="py-2 px-3 text-xs border border-[#CCCCCC] hover:border-[#111111] rounded-[4px] text-[#111111] transition-colors"
            >
              Kader (Client/Créateur)
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickDemoLogin('admin@maamfoogou.bf', 'Admin2026!')
              }
              className="py-2 px-3 text-xs border border-[#CCCCCC] hover:border-[#111111] rounded-[4px] text-[#111111] transition-colors"
            >
              Aminata (Admin)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
