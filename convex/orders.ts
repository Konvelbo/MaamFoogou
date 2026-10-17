import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import {
  activePaymentProvider,
  type MobileMoneyOperator,
} from './paymentProvider'
import {
  awardServerXp,
  requireAdmin,
  requireUser,
  sanitizeServerText,
} from './helpers'

export const RESERVATION_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Mutation protégée (Section 8.1) :
 * Crée une commande "pending", revérifie le stock côté serveur et réserve (reserved += n) dans la même transaction.
 */
export const createOrder = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.id('designs'),
    color: v.string(),
    size: v.string(),
    quantity: v.number(),
    operator: v.union(
      v.literal('orange_money_bf'),
      v.literal('moov_money_bf'),
      v.literal('wave_bf')
    ),
    phoneNumber: v.string(),
    fullName: v.string(),
    city: v.string(),
    district: v.string(),
    landmark: v.string(),
    referralCode: v.optional(v.string()),
    instantTestMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const qty = Math.max(1, Math.min(50, Math.floor(args.quantity)))

    const design = await ctx.db.get(args.designId)
    if (!design) {
      throw new Error('Modèle introuvable.')
    }

    // 1. Revérification stricte du stock côté serveur
    const stockRow = await ctx.db
      .query('stock')
      .withIndex('by_variant', (q: any) =>
        q.eq('color', args.color).eq('size', args.size)
      )
      .first()

    if (!stockRow) {
      throw new Error("Cette couleur ou taille n'existe pas en stock.")
    }

    const available = Math.max(0, stockRow.quantity - stockRow.reserved)
    if (available === 0) {
      throw new Error(
        stockRow.restockDate
          ? `Rupture de stock. Disponible à partir du ${stockRow.restockDate}.`
          : 'Rupture de stock sur cette variante.'
      )
    }

    if (available < qty) {
      throw new Error(
        `Seulement ${available} exemplaire(s) disponible(s) pour cette variante.`
      )
    }

    const unitPrice = design.price ?? 10000 // Prix en FCFA
    const totalAmount = unitPrice * qty

    // 2. Initialisation de la transaction auprès du prestataire Mobile Money abstrait
    const paymentInit = activePaymentProvider.createPayment({
      orderId: `ord_${Date.now()}`,
      amountFcfa: totalAmount,
      customerPhone: args.phoneNumber,
      customerName: args.fullName,
      operator: args.operator as MobileMoneyOperator,
    })

    if (args.instantTestMode) {
      // Mode Test 1-clic : décrémentation directe du stock et validation immédiate côté serveur
      await ctx.db.patch(stockRow._id, {
        quantity: Math.max(0, stockRow.quantity - qty),
      })

      const orderId = await ctx.db.insert('orders', {
        userId: user._id,
        designId: args.designId,
        color: args.color,
        size: args.size,
        quantity: qty,
        unitPrice,
        totalAmount,
        status: 'paid',
        paymentProvider: args.operator,
        paymentReference: paymentInit.paymentReference,
        phoneNumber: sanitizeServerText(args.phoneNumber, 25),
        deliveryInfo: {
          fullName: sanitizeServerText(args.fullName, 60),
          phone: sanitizeServerText(args.phoneNumber, 25),
          city: sanitizeServerText(args.city, 50),
          district: sanitizeServerText(args.district, 60),
          landmark: sanitizeServerText(args.landmark, 120),
        },
        referralCodeUsed: args.referralCode,
        createdAt: Date.now(),
        paidAt: Date.now(),
      })

      const isCreatorModel =
        design.source === 'creator' &&
        String(design.ownerId) !== String(user._id)

      await awardServerXp(
        ctx,
        user._id,
        isCreatorModel
          ? 'creator_design_purchased_buyer'
          : 'custom_tshirt_purchased',
        String(orderId)
      )

      if (isCreatorModel) {
        await awardServerXp(
          ctx,
          design.ownerId,
          'creator_design_purchased_creator',
          String(orderId)
        )
      }

      return {
        orderId,
        paymentReference: paymentInit.paymentReference,
        ussdPromptCode: paymentInit.ussdPromptCode,
        expiresInSeconds: paymentInit.expiresInSeconds,
        totalAmount,
        status: 'paid' as const,
      }
    }

    // 3. Réservation atomique du stock : reserved += n
    await ctx.db.patch(stockRow._id, {
      reserved: stockRow.reserved + qty,
    })

    // 4. Création de la commande à l'état "pending"
    const orderId = await ctx.db.insert('orders', {
      userId: user._id,
      designId: args.designId,
      color: args.color,
      size: args.size,
      quantity: qty,
      unitPrice,
      totalAmount,
      status: 'pending',
      paymentProvider: args.operator,
      paymentReference: paymentInit.paymentReference,
      phoneNumber: sanitizeServerText(args.phoneNumber, 25),
      deliveryInfo: {
        fullName: sanitizeServerText(args.fullName, 60),
        phone: sanitizeServerText(args.phoneNumber, 25),
        city: sanitizeServerText(args.city, 50),
        district: sanitizeServerText(args.district, 60),
        landmark: sanitizeServerText(args.landmark, 120),
      },
      referralCodeUsed: args.referralCode,
      createdAt: Date.now(),
    })

    // 5. Attribution en attente si un lien de partage (?ref=CODE) valide est présent (anti auto-parrainage)
    if (args.referralCode) {
      const cleanRef = args.referralCode.trim().toUpperCase()
      const shareLink = await ctx.db
        .query('shareLinks')
        .withIndex('by_code', (q: any) => q.eq('code', cleanRef))
        .first()

      const refUser = shareLink
        ? await ctx.db.get(shareLink.userId)
        : await ctx.db
            .query('users')
            .withIndex('by_referral_code', (q: any) =>
              q.eq('referralCode', cleanRef)
            )
            .first()

      if (refUser && String(refUser._id) !== String(user._id)) {
        await ctx.db.insert('attributedPurchases', {
          referrerId: refUser._id,
          buyerId: user._id,
          orderId,
          designId: args.designId,
          status: 'pending',
          createdAt: Date.now(),
        })
      }
    }

    return {
      orderId,
      paymentReference: paymentInit.paymentReference,
      ussdPromptCode: paymentInit.ussdPromptCode,
      expiresInSeconds: paymentInit.expiresInSeconds,
      totalAmount,
      status: 'pending' as const,
    }
  },
})

/**
 * Mutation de test Mobile Money : simule le retour du webhook FasoPay sur une commande en attente
 */
export const simulateTestWebhook = mutation({
  args: {
    sessionToken: v.string(),
    paymentReference: v.string(),
    outcome: v.union(
      v.literal('SUCCESS'),
      v.literal('FAILED'),
      v.literal('EXPIRED')
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const order = await ctx.db
      .query('orders')
      .withIndex('by_payment_reference', (q: any) =>
        q.eq('paymentReference', args.paymentReference)
      )
      .first()

    if (!order) {
      return { processed: false, status: 'not_found' }
    }
    if (String(order.userId) !== String(user._id) && user.role !== 'admin') {
      throw new Error('Action non autorisée sur cette commande.')
    }
    if (order.status !== 'pending') {
      return { processed: false, status: order.status }
    }

    const stockRow = await ctx.db
      .query('stock')
      .withIndex('by_variant', (q: any) =>
        q.eq('color', order.color).eq('size', order.size)
      )
      .first()

    if (args.outcome === 'SUCCESS') {
      if (stockRow) {
        await ctx.db.patch(stockRow._id, {
          quantity: Math.max(0, stockRow.quantity - order.quantity),
          reserved: Math.max(0, stockRow.reserved - order.quantity),
        })
      }
      await ctx.db.patch(order._id, {
        status: 'paid',
        paidAt: Date.now(),
      })

      const design = await ctx.db.get(order.designId)
      const isCreatorModel =
        design &&
        design.source === 'creator' &&
        String(design.ownerId) !== String(order.userId)

      await awardServerXp(
        ctx,
        order.userId,
        isCreatorModel
          ? 'creator_design_purchased_buyer'
          : 'custom_tshirt_purchased',
        String(order._id)
      )

      if (isCreatorModel && design) {
        await awardServerXp(
          ctx,
          design.ownerId,
          'creator_design_purchased_creator',
          String(order._id)
        )
      }

      return { processed: true, status: 'paid' }
    }

    const nextStatus = args.outcome === 'EXPIRED' ? 'expired' : 'failed'
    if (stockRow) {
      await ctx.db.patch(stockRow._id, {
        reserved: Math.max(0, stockRow.reserved - order.quantity),
      })
    }
    await ctx.db.patch(order._id, { status: nextStatus })
    return { processed: true, status: nextStatus }
  },
})

/**
 * Mutation INTERNE (Section 8.2 & 11) :
 * Appelée UNIQUEMENT par le webhook HTTP du prestataire Mobile Money.
 * Idempotente : ne traite la commande que si son statut est encore "pending".
 * Décrémente quantity -= n et reserved -= n, passe la commande à "paid" et distribue l'XP.
 */
export const confirmPayment = internalMutation({
  args: {
    paymentReference: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query('orders')
      .withIndex('by_payment_reference', (q: any) =>
        q.eq('paymentReference', args.paymentReference)
      )
      .first()

    if (!order) {
      return { processed: false, reason: 'order_not_found' }
    }

    // Garantie d'idempotence : si le webhook arrive deux fois, on ignore le second appel
    if (order.status !== 'pending') {
      return { processed: false, reason: 'already_processed', status: order.status }
    }

    // 1. Décrémentation définitive du stock réel et libération de la réservation
    const stockRow = await ctx.db
      .query('stock')
      .withIndex('by_variant', (q: any) =>
        q.eq('color', order.color).eq('size', order.size)
      )
      .first()

    if (stockRow) {
      await ctx.db.patch(stockRow._id, {
        quantity: Math.max(0, stockRow.quantity - order.quantity),
        reserved: Math.max(0, stockRow.reserved - order.quantity),
      })
    }

    // 2. Passage de la commande à "paid"
    await ctx.db.patch(order._id, {
      status: 'paid',
      paidAt: Date.now(),
    })

    // 3. Attribution de l'XP côté serveur (Acheteur, Créateur, Partageur ?ref=, Parrain d'ami)
    const design = await ctx.db.get(order.designId)
    const isCreatorModel =
      design &&
      design.source === 'creator' &&
      String(design.ownerId) !== String(order.userId)

    await awardServerXp(
      ctx,
      order.userId,
      isCreatorModel
        ? 'creator_design_purchased_buyer'
        : 'custom_tshirt_purchased',
      String(order._id)
    )

    if (isCreatorModel && design) {
      await awardServerXp(
        ctx,
        design.ownerId,
        'creator_design_purchased_creator',
        String(order._id)
      )
    }

    // Validation de l'achat attribué via lien de partage (?ref=)
    const attributed = await ctx.db
      .query('attributedPurchases')
      .withIndex('by_order', (q: any) => q.eq('orderId', order._id))
      .first()

    if (attributed && attributed.status === 'pending') {
      await ctx.db.patch(attributed._id, {
        status: 'validated',
        validatedAt: Date.now(),
      })

      if (order.referralCodeUsed) {
        const shareLink = await ctx.db
          .query('shareLinks')
          .withIndex('by_code', (q: any) =>
            q.eq('code', order.referralCodeUsed!)
          )
          .first()
        if (shareLink) {
          await ctx.db.patch(shareLink._id, {
            purchasesCount: (shareLink.purchasesCount || 0) + 1,
          })
        }
      }

      await awardServerXp(
        ctx,
        attributed.referrerId,
        'share_link_purchase',
        String(order._id)
      )
    }

    // Validation du parrainage d'ami (Section 10.B : XP versé au 1er achat réel du filleul)
    const referral = await ctx.db
      .query('referrals')
      .withIndex('by_referee', (q: any) => q.eq('refereeId', order.userId))
      .first()

    if (referral && referral.status === 'registered') {
      await ctx.db.patch(referral._id, {
        status: 'rewarded',
        rewardedAt: Date.now(),
      })
      await awardServerXp(
        ctx,
        referral.referrerId,
        'friend_referral_completed',
        String(order.userId)
      )
    }

    return { processed: true, orderId: order._id, status: 'paid' }
  },
})

/**
 * Mutation INTERNE (Section 8.3) :
 * Paiement échoué ou expiré → libère uniquement la réservation (reserved -= n).
 */
export const failOrExpirePayment = internalMutation({
  args: {
    paymentReference: v.string(),
    reason: v.union(v.literal('failed'), v.literal('expired')),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query('orders')
      .withIndex('by_payment_reference', (q: any) =>
        q.eq('paymentReference', args.paymentReference)
      )
      .first()

    if (!order || order.status !== 'pending') {
      return { processed: false }
    }

    const stockRow = await ctx.db
      .query('stock')
      .withIndex('by_variant', (q: any) =>
        q.eq('color', order.color).eq('size', order.size)
      )
      .first()

    if (stockRow) {
      await ctx.db.patch(stockRow._id, {
        reserved: Math.max(0, stockRow.reserved - order.quantity),
      })
    }

    await ctx.db.patch(order._id, { status: args.reason })

    const attributed = await ctx.db
      .query('attributedPurchases')
      .withIndex('by_order', (q: any) => q.eq('orderId', order._id))
      .first()

    if (attributed && attributed.status === 'pending') {
      await ctx.db.patch(attributed._id, { status: 'cancelled' })
    }

    return { processed: true, orderId: order._id, status: args.reason }
  },
})

/**
 * Mutation INTERNE appelée toutes les 5 minutes par le Cron Convex (Section 8.4) :
 * Annule toutes les commandes "pending" de plus de 15 minutes et libère leur stock réservé.
 */
export const expireStalePendingOrders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RESERVATION_TIMEOUT_MS
    const staleOrders = await ctx.db
      .query('orders')
      .withIndex('by_status', (q: any) =>
        q.eq('status', 'pending').lt('createdAt', cutoff)
      )
      .collect()

    let releasedCount = 0
    for (const order of staleOrders) {
      const stockRow = await ctx.db
        .query('stock')
        .withIndex('by_variant', (q: any) =>
          q.eq('color', order.color).eq('size', order.size)
        )
        .first()

      if (stockRow) {
        await ctx.db.patch(stockRow._id, {
          reserved: Math.max(0, stockRow.reserved - order.quantity),
        })
      }

      await ctx.db.patch(order._id, { status: 'expired' })

      const attributed = await ctx.db
        .query('attributedPurchases')
        .withIndex('by_order', (q: any) => q.eq('orderId', order._id))
        .first()

      if (attributed && attributed.status === 'pending') {
        await ctx.db.patch(attributed._id, { status: 'cancelled' })
      }
      releasedCount++
    }

    return { releasedCount }
  },
})

/**
 * Requête protégée : historique des commandes de l'utilisateur connecté
 */
export const listMyOrders = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const rows = await ctx.db
      .query('orders')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .order('desc')
      .collect()

    return await Promise.all(
      rows.map(async (o: any) => {
        const design: any = await ctx.db.get(o.designId)
        return {
          ...o,
          id: o._id,
          designName: design?.name || 'T-shirt Maamfoogou',
          previewFrontUrl: design?.previewFrontUrl,
        }
      })
    )
  },
})

/**
 * Requête Admin : liste toutes les commandes pour le suivi d'atelier et des réservations
 */
export const listAllOrdersAdmin = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    const rows = await ctx.db.query('orders').order('desc').collect()
    return await Promise.all(
      rows.map(async (o: any) => {
        const design: any = await ctx.db.get(o.designId)
        return {
          ...o,
          id: o._id,
          designName: design?.name || 'T-shirt Maamfoogou',
        }
      })
    )
  },
})
