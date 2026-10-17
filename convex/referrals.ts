import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { awardServerXp, getTodayKey, requireUser } from './helpers'

function generateShareCode(): string {
  return `SH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

/**
 * Mutation protégée (Section 10.A) :
 * Génère ou récupère un lien de partage unique par utilisateur et par produit (/p/{designId}?ref={code})
 * sans jamais exposer l'identifiant interne de l'utilisateur.
 */
export const getOrCreateShareLink = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.id('designs'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)

    const existing = await ctx.db
      .query('shareLinks')
      .withIndex('by_user_and_design', (q: any) =>
        q.eq('userId', user._id).eq('designId', args.designId)
      )
      .first()

    if (existing) {
      return {
        code: existing.code,
        clicksCount: existing.clicksCount,
        purchasesCount: existing.purchasesCount,
      }
    }

    const code = generateShareCode()
    await ctx.db.insert('shareLinks', {
      code,
      userId: user._id,
      designId: args.designId,
      clicksCount: 0,
      purchasesCount: 0,
      createdAt: Date.now(),
    })

    return {
      code,
      clicksCount: 0,
      purchasesCount: 0,
    }
  },
})

/**
 * Mutation publique (Section 10.A & 10.C) :
 * Enregistre un clic sur un lien ?ref={code} (même si le visiteur n'est pas connecté).
 * Anti-fraude :
 * - Interdit l'auto-clic (si le visiteur est connecté sur le compte du parrain)
 * - Déduplique les clics par (code + empreinte appareil + jour)
 * - Applique le plafond quotidien d'XP via awardServerXp
 */
export const recordShareClick = mutation({
  args: {
    code: v.string(),
    designId: v.optional(v.id('designs')),
    deviceFingerprint: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanCode = args.code.trim().toUpperCase()
    if (!cleanCode) return { recorded: false, reason: 'empty_code' }

    const shareLink = await ctx.db
      .query('shareLinks')
      .withIndex('by_code', (q: any) => q.eq('code', cleanCode))
      .first()

    const refUser = shareLink
      ? await ctx.db.get(shareLink.userId)
      : await ctx.db
          .query('users')
          .withIndex('by_referral_code', (q: any) =>
            q.eq('referralCode', cleanCode)
          )
          .first()

    if (!refUser) {
      return { recorded: false, reason: 'unknown_ref' }
    }

    // Anti-fraude : interdire l'auto-clic si l'utilisateur courant est le propriétaire du lien
    if (args.sessionToken) {
      try {
        const viewer = await requireUser(ctx, args.sessionToken)
        if (String(viewer._id) === String(refUser._id)) {
          return { recorded: false, reason: 'self_click_blocked' }
        }
      } catch {
        // Visiteur non connecté : autorisé
      }
    }

    const dayKey = getTodayKey()
    const duplicate = await ctx.db
      .query('trackingClicks')
      .withIndex('by_code_and_fingerprint', (q: any) =>
        q
          .eq('code', cleanCode)
          .eq('deviceFingerprint', args.deviceFingerprint)
          .eq('dayKey', dayKey)
      )
      .first()

    if (duplicate) {
      return { recorded: false, reason: 'duplicate_device_today' }
    }

    await ctx.db.insert('trackingClicks', {
      code: cleanCode,
      referrerId: refUser._id,
      designId: args.designId ?? shareLink?.designId,
      deviceFingerprint: args.deviceFingerprint,
      dayKey,
      createdAt: Date.now(),
    })

    if (shareLink) {
      await ctx.db.patch(shareLink._id, {
        clicksCount: (shareLink.clicksCount || 0) + 1,
      })
    }

    const xp = await awardServerXp(
      ctx,
      refUser._id,
      'share_link_click',
      `${cleanCode}_${args.deviceFingerprint}_${dayKey}`
    )

    return {
      recorded: true,
      referrerName: refUser.name,
      xpAwarded: xp.points,
    }
  },
})

/**
 * Requête protégée : statistiques de partage et de parrainage de l'utilisateur
 */
export const getMySharingStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const links = await ctx.db
      .query('shareLinks')
      .withIndex('by_user_and_design', (q: any) => q.eq('userId', user._id))
      .collect()

    const purchases = await ctx.db
      .query('attributedPurchases')
      .withIndex('by_referrer', (q: any) => q.eq('referrerId', user._id))
      .collect()

    const referrals = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q: any) => q.eq('referrerId', user._id))
      .collect()

    return {
      referralCode: user.referralCode,
      totalClicks: links.reduce(
        (sum: number, l: any) => sum + (l.clicksCount || 0),
        0
      ),
      validatedPurchasesCount: purchases.filter(
        (p: any) => p.status === 'validated'
      ).length,
      pendingPurchasesCount: purchases.filter(
        (p: any) => p.status === 'pending'
      ).length,
      registeredFriendsCount: referrals.length,
      rewardedFriendsCount: referrals.filter(
        (r: any) => r.status === 'rewarded'
      ).length,
    }
  },
})
