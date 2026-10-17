import { mutation, query } from './_generated/server'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import {
  COMMENT_MAX_LENGTH,
  COMMENT_RATE_LIMIT_PER_MINUTE,
} from './xpConfig'
import {
  awardServerXp,
  computeUserXpSummary,
  requireAdmin,
  requireUser,
  sanitizeServerText,
} from './helpers'

/**
 * Requête publique paginée (Section 6) :
 * Liste les commentaires visibles ou signalés d'un modèle, les plus récents d'abord,
 * enrichis du nom, de l'avatar et du niveau (1 à 100) de l'auteur.
 */
export const listComments = query({
  args: {
    designId: v.id('designs'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const paginated = await ctx.db
      .query('comments')
      .withIndex('by_design', (q: any) => q.eq('designId', args.designId))
      .order('desc')
      .filter((q: any) => q.neq(q.field('status'), 'hidden'))
      .paginate(args.paginationOpts)

    const enrichedPage = await Promise.all(
      paginated.page.map(async (comment: any) => {
        const author = await ctx.db.get(comment.userId)
        const xpSummary = author
          ? await computeUserXpSummary(ctx, author._id)
          : { level: 1 }

        const photoUrl = comment.photoStorageId
          ? (await ctx.storage.getUrl(comment.photoStorageId)) ||
            comment.photoUrl
          : comment.photoUrl

        return {
          ...comment,
          id: comment._id,
          authorName: author?.name || 'Membre Maamfoogou',
          authorAvatar: author?.avatarUrl,
          authorLevel: xpSummary.level,
          authorRole: author?.role || 'user',
          photoUrl,
        }
      })
    )

    return {
      ...paginated,
      page: enrichedPage,
    }
  },
})

/**
 * Mutation protégée (Section 6) :
 * Ajoute un commentaire ou une réponse (avec protection XSS, limite 500 caractères et anti-spam 5/min).
 */
export const addComment = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.id('designs'),
    text: v.string(),
    parentId: v.optional(v.id('comments')),
    photoStorageId: v.optional(v.id('_storage')),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const design = await ctx.db.get(args.designId)
    if (!design) {
      throw new Error('Modèle introuvable.')
    }

    const cleanText = sanitizeServerText(args.text, COMMENT_MAX_LENGTH)
    if (!cleanText) {
      throw new Error('Le commentaire ne peut pas être vide.')
    }

    // Limite de fréquence anti-spam : maximum 5 commentaires par minute par utilisateur
    const oneMinuteAgo = Date.now() - 60 * 1000
    const recentUserComments = await ctx.db
      .query('comments')
      .withIndex('by_user', (q: any) =>
        q.eq('userId', user._id).gt('createdAt', oneMinuteAgo)
      )
      .collect()

    if (recentUserComments.length >= COMMENT_RATE_LIMIT_PER_MINUTE) {
      throw new Error(
        `Limite anti-spam atteinte (${COMMENT_RATE_LIMIT_PER_MINUTE} commentaires max par minute). Patientez quelques secondes.`
      )
    }

    const commentId = await ctx.db.insert('comments', {
      designId: args.designId,
      userId: user._id,
      text: cleanText,
      parentId: args.parentId,
      photoStorageId: args.photoStorageId,
      photoUrl: args.photoUrl,
      status: 'visible',
      createdAt: Date.now(),
    })

    await ctx.db.patch(args.designId, {
      commentsCount: (design.commentsCount || 0) + 1,
    })

    // Attribution d'XP (avis avec photo du t-shirt porté = +100 XP, commentaire classique = +10 XP plafonné/jour)
    const xpAction =
      args.photoStorageId || args.photoUrl
        ? 'photo_review_posted'
        : 'comment_posted'
    const xp = await awardServerXp(
      ctx,
      user._id,
      xpAction,
      String(commentId)
    )

    return {
      commentId,
      xpAwarded: xp.points,
    }
  },
})

/**
 * Mutation protégée : édition d'un commentaire (uniquement par son auteur)
 */
export const editComment = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id('comments'),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('Commentaire introuvable.')

    if (String(comment.userId) !== String(user._id)) {
      throw new Error(
        'Action refusée : seul l’auteur peut modifier ce commentaire.'
      )
    }

    const cleanText = sanitizeServerText(args.text, COMMENT_MAX_LENGTH)
    if (!cleanText) {
      throw new Error('Le commentaire ne peut pas être vide.')
    }

    await ctx.db.patch(args.commentId, {
      text: cleanText,
      editedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Mutation protégée : suppression d'un commentaire (uniquement par son auteur)
 */
export const deleteComment = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id('comments'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('Commentaire introuvable.')

    if (String(comment.userId) !== String(user._id)) {
      throw new Error(
        'Action refusée : seul l’auteur peut supprimer ce commentaire.'
      )
    }

    await ctx.db.delete(args.commentId)

    const design = await ctx.db.get(comment.designId)
    if (design) {
      await ctx.db.patch(comment.designId, {
        commentsCount: Math.max(0, (design.commentsCount || 1) - 1),
      })
    }

    return { success: true }
  },
})

/**
 * Mutation protégée : tout utilisateur connecté peut signaler un commentaire
 */
export const reportComment = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id('comments'),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.sessionToken)
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('Commentaire introuvable.')

    if (comment.status === 'visible') {
      await ctx.db.patch(args.commentId, { status: 'reported' })
    }
    return { success: true }
  },
})

/**
 * Requête Admin : liste tous les commentaires signalés ("reported") pour modération
 */
export const listReportedComments = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    const reported = await ctx.db
      .query('comments')
      .withIndex('by_status', (q: any) => q.eq('status', 'reported'))
      .order('desc')
      .collect()

    return await Promise.all(
      reported.map(async (c: any) => {
        const author = await ctx.db.get(c.userId)
        const design = await ctx.db.get(c.designId)
        return {
          ...c,
          id: c._id,
          authorName: author?.name || 'Utilisateur',
          designName: design?.name || 'Modèle',
        }
      })
    )
  },
})

/**
 * Mutation Admin : masquer ("hidden") ou réapprouver ("visible") un commentaire signalé
 */
export const hideComment = mutation({
  args: {
    sessionToken: v.string(),
    commentId: v.id('comments'),
    status: v.union(v.literal('hidden'), v.literal('visible')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error('Commentaire introuvable.')

    await ctx.db.patch(args.commentId, { status: args.status })

    // Ajustement du compteur si masqué
    const design = await ctx.db.get(comment.designId)
    if (design && args.status === 'hidden' && comment.status !== 'hidden') {
      await ctx.db.patch(comment.designId, {
        commentsCount: Math.max(0, (design.commentsCount || 1) - 1),
      })
    }

    return { success: true }
  },
})
