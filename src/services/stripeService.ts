import { loadStripe } from '@stripe/stripe-js'

const stripePublicKey =
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_51FasoDesignTestModeKey0000'

let stripePromise: ReturnType<typeof loadStripe> | null = null

/**
 * Initialise le SDK Stripe en mode test
 */
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublicKey)
  }
  return stripePromise
}

/**
 * Simule ou déclenche une session de paiement Stripe en mode test
 */
export async function processStripeTestPayment(params: {
  amountEur: number
  customerEmail: string
  cardNumber?: string
}): Promise<{ success: boolean; sessionId: string; error?: string }> {
  // Initialisation du client Stripe.js
  await getStripe()

  // Délai réaliste de validation bancaire en mode test Stripe
  await new Promise((resolve) => setTimeout(resolve, 900))

  if (params.amountEur <= 0) {
    return {
      success: false,
      sessionId: '',
      error: 'Le montant de la commande doit être supérieur à 0 €.',
    }
  }

  // Génération d'un identifiant de session Stripe Test conforme
  const randomSuffix = Math.random().toString(36).substring(2, 12).toUpperCase()
  const sessionId = `cs_test_a1B2c3_${randomSuffix}`

  return {
    success: true,
    sessionId,
  }
}
