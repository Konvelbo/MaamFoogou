import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  type MaamfoogouDesign,
  fetchDesignById,
  registerIncomingReferralRef,
  syncFromConvex,
  useMaamfoogouStore,
} from '../services/maamfoogouStore'
import { ProductDetailView } from '../components/maamfoogou/ProductDetailView'
import { StoreLayout } from '../components/maamfoogou/StoreLayout'

export const Route = createFileRoute('/produit/$designId')({
  component: ProduitDetailPage,
})

function ProduitDetailPage() {
  const { designId } = Route.useParams()
  const navigate = useNavigate()
  const state = useMaamfoogouStore()

  const [design, setDesign] = useState<MaamfoogouDesign | null>(() => {
    return state.designs.find((d) => d.id === designId) || null
  })
  const [loading, setLoading] = useState(!design)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' })
      const params = new URLSearchParams(window.location.search)
      const refParam = params.get('ref')
      if (refParam) {
        registerIncomingReferralRef(refParam, designId)
      }
    }
  }, [designId])

  useEffect(() => {
    let isCurrent = true
    const cached = state.designs.find((d) => d.id === designId)
    if (cached) {
      setDesign(cached)
      setLoading(false)
      return
    }

    if (!state.hasSynced && !state.isSyncing) {
      syncFromConvex()
    }

    setLoading(true)
    fetchDesignById(designId).then((fetched) => {
      if (!isCurrent) return
      setDesign(fetched)
      setLoading(false)
    })

    return () => {
      isCurrent = false
    }
  }, [designId, state.designs, state.hasSynced, state.isSyncing])

  return (
    <StoreLayout activeNav="none">
      {loading || (state.isSyncing && !design) ? (
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-20 text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-none animate-spin mx-auto" />
          <p className="text-xs tracking-wider uppercase text-[#666666]">
            Chargement du produit 3D...
          </p>
        </div>
      ) : design ? (
        <ProductDetailView
          design={design}
          onBackToCatalog={() => navigate({ to: '/' })}
          onOpenCustomizerWithDesign={(d) => {
            navigate({
              to: '/',
              search: { customize: d.id },
            })
          }}
        />
      ) : (
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-24 text-center space-y-6">
          <h1 className="text-xl font-bold uppercase tracking-wider text-[#111111]">
            Produit introuvable
          </h1>
          <p className="text-xs text-[#666666] max-w-md mx-auto">
            Le produit avec l'identifiant{' '}
            <code className="bg-[#F5F5F5] px-2 py-0.5 border border-[#E5E5E5] text-[#111111]">
              {designId}
            </code>{' '}
            n'existe pas ou n'est plus publié sur la boutique.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="px-6 py-3 text-xs font-semibold uppercase tracking-wider bg-[#111111] text-white rounded-none hover:opacity-80 transition-opacity"
          >
            Retourner à la boutique
          </button>
        </div>
      )}
    </StoreLayout>
  )
}
