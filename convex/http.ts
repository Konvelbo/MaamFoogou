import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { activePaymentProvider } from './paymentProvider'

const http = httpRouter()

/**
 * Webhook HTTP Convex (Section 11) :
 * Point d'entrée appelé par le prestataire Mobile Money burkinabé (Orange Money / Moov Money via FasoPay).
 * Vérifie la signature cryptographique avant d'appeler la mutation interne confirmPayment ou failOrExpirePayment.
 * Jamais de confirmation de paiement déclenchée par le front-end.
 */
http.route({
  path: '/webhooks/mobile-money',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get('x-fasopay-signature')
    const rawBody = await request.text()

    const isSignatureValid = activePaymentProvider.verifyWebhookSignature(
      rawBody,
      signature
    )
    if (!isSignatureValid) {
      return new Response(
        JSON.stringify({
          error: 'Signature de webhook Mobile Money invalide.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      const event = activePaymentProvider.parseWebhookPayload(rawBody)

      if (event.status === 'SUCCESS') {
        const result = await ctx.runMutation(internal.orders.confirmPayment, {
          paymentReference: event.paymentReference,
        })
        return new Response(JSON.stringify({ ok: true, result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } else {
        const reason = event.status === 'EXPIRED' ? 'expired' : 'failed'
        const result = await ctx.runMutation(
          internal.orders.failOrExpirePayment,
          {
            paymentReference: event.paymentReference,
            reason,
          }
        )
        return new Response(JSON.stringify({ ok: true, result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Payload invalide',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

export default http
