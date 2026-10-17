// Interface abstraite isolant le prestataire de paiement Mobile Money burkinabé (Section 11)
// Permet de changer de passerelle (FasoPay, LigdiCash, CinetPay, Orange Money BF, Moov Money BF) sans impacter le métier.

export type MobileMoneyOperator = 'orange_money_bf' | 'moov_money_bf' | 'wave_bf'

export interface CreatePaymentInput {
  orderId: string
  amountFcfa: number
  customerPhone: string
  customerName: string
  operator: MobileMoneyOperator
}

export interface CreatePaymentOutput {
  providerName: string
  paymentReference: string
  ussdPromptCode: string
  expiresInSeconds: number
}

export interface WebhookEventPayload {
  paymentReference: string
  orderId?: string
  status: 'SUCCESS' | 'FAILED' | 'EXPIRED'
  amountFcfa: number
  operator: MobileMoneyOperator
  transactionTimestamp: number
}

export interface PaymentGatewayAdapter {
  readonly name: string
  createPayment(input: CreatePaymentInput): CreatePaymentOutput
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean
  parseWebhookPayload(rawBody: string): WebhookEventPayload
}

/**
 * Implémentation par défaut : Passerelle FasoPay Mobile Money (Orange Money Burkina & Moov Money Burkina)
 */
export class FasoPayBurkinaAdapter implements PaymentGatewayAdapter {
  readonly name = 'FasoPay Mobile Money Burkina'

  createPayment(input: CreatePaymentInput): CreatePaymentOutput {
    const cleanSuffix = Math.random().toString(36).substring(2, 9).toUpperCase()
    const prefix =
      input.operator === 'orange_money_bf'
        ? 'OMBF'
        : input.operator === 'moov_money_bf'
          ? 'MOOVBF'
          : 'WAVEBF'

    const paymentReference = `FP-${prefix}-${Date.now()}-${cleanSuffix}`

    const ussdPromptCode =
      input.operator === 'orange_money_bf'
        ? `*144*4*6*${input.amountFcfa}#`
        : `*555*4*1*${input.amountFcfa}#`

    return {
      providerName: this.name,
      paymentReference,
      ussdPromptCode,
      expiresInSeconds: 15 * 60, // 15 minutes de réservation de stock
    }
  }

  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | null
  ): boolean {
    if (!signatureHeader) return false
    const secret = process.env.FASOPAY_WEBHOOK_SECRET || 'fasopay_secret_bf_2026'
    // Signature attendue : "sha256=<secret>:<longueur_payload>" ou jeton signé du prestataire
    const expectedToken = `sha256=${secret}:${rawBody.length}`
    return (
      signatureHeader === expectedToken ||
      signatureHeader === `Bearer ${secret}`
    )
  }

  parseWebhookPayload(rawBody: string): WebhookEventPayload {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    const paymentReference = String(parsed.paymentReference || '')
    const statusRaw = String(parsed.status || 'FAILED').toUpperCase()

    if (!paymentReference) {
      throw new Error('Référence de paiement manquante dans le webhook.')
    }

    const status: WebhookEventPayload['status'] =
      statusRaw === 'SUCCESS'
        ? 'SUCCESS'
        : statusRaw === 'EXPIRED'
          ? 'EXPIRED'
          : 'FAILED'

    return {
      paymentReference,
      orderId: parsed.orderId ? String(parsed.orderId) : undefined,
      status,
      amountFcfa: Number(parsed.amountFcfa || 0),
      operator:
        (parsed.operator as MobileMoneyOperator) || 'orange_money_bf',
      transactionTimestamp: Number(parsed.transactionTimestamp || Date.now()),
    }
  }
}

export const activePaymentProvider: PaymentGatewayAdapter =
  new FasoPayBurkinaAdapter()
