import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { awardServerXp, requireUser } from './helpers'

/**
 * Mutation protégée (Section 5) :
 * Liker ou retirer son like sur un modèle.
 * - Met à jour likesCount sur le design dans la même mutation
 * - Ajoute ou retire automatiquement le modèle de "Mes collections > Produits sauvegardés"
 * - Attribue de l'XP au créateur du modèle si l'utilisateur qui like n'est pas le créateur (anti auto-like)
 */
export const toggleLike = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.id('designs'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const design = await ctx.db.get(args.designId)
    if (!design) {
      throw new Error('Ce modèle est introuvable.')
    }

    const existing = await ctx.db
      .query('likes')
      .withIndex('by_user_and_design', (q: any) =>
        q.eq('userId', user._id).eq('designId', args.designId)
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
      const nextCount = Math.max(0, (design.likesCount || 0) - 1)
      await ctx.db.patch(args.designId, { likesCount: nextCount })
      return { liked: false, likesCount: nextCount }
    }

    await ctx.db.insert('likes', {
      userId: user._id,
      designId: args.designId,
      createdAt: Date.now(),
    })

    const nextCount = (design.likesCount || 0) + 1
    await ctx.db.patch(args.designId, { likesCount: nextCount })

    // XP pour le créateur si un autre utilisateur aime son modèle (une seule fois par couple user/design)
    if (String(design.ownerId) !== String(user._id)) {
      const refKey = `like_${user._id}_${args.designId}`
      const ownerXpEvents = await ctx.db
        .query('xpEvents')
        .withIndex('by_user', (q: any) => q.eq('userId', design.ownerId))
        .collect()

      const alreadyRewarded = ownerXpEvents.some(
        (ev: any) => ev.reference === refKey
      )
      if (!alreadyRewarded) {
        await awardServerXp(
          ctx,
          design.ownerId,
          'design_liked_by_other',
          refKey
        )
      }
    }

    return { liked: true, likesCount: nextCount }
  },
})

/**
 * Requête : vérifie si l'utilisateur courant a liké un modèle donné
 */
export const hasLiked = query({
  args: {
    sessionToken: v.optional(v.string()),
    designId: v.id('designs'),
  },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return false
    try {
      const user = await requireUser(ctx, args.sessionToken)
      const existing = await ctx.db
        .query('likes')
        .withIndex('by_user_and_design', (q: any) =>
          q.eq('userId', user._id).eq('designId', args.designId)
        )
        .first()
      return Boolean(existing)
    } catch {
      return false
    }
  },
})

/**
 * Requête : renvoie la liste des identifiants de modèles likés par l'utilisateur connecté
 */
export const getLikedDesignIds = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return []
    try {
      const user = await requireUser(ctx, args.sessionToken)
      const rows = await ctx.db
        .query('likes')
        .withIndex('by_user', (q: any) => q.eq('userId', user._id))
        .collect()
      return rows.map((r: any) => String(r.designId))
    } catch {
      return []
    }
  },
})
