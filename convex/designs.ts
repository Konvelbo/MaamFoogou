import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import {
  awardServerXp,
  requireAdmin,
  requireUser,
  sanitizeSafeUrl,
  sanitizeServerText,
} from './helpers'

async function hydrateDesignStorageUrls(ctx: any, design: any) {
  const previewFrontUrl = design.previewFront
    ? (await ctx.storage.getUrl(design.previewFront)) || design.previewFrontUrl
    : design.previewFrontUrl

  const previewBackUrl = design.previewBack
    ? (await ctx.storage.getUrl(design.previewBack)) || design.previewBackUrl
    : design.previewBackUrl

  const printFrontUrl = design.printFront
    ? await ctx.storage.getUrl(design.printFront)
    : undefined

  const printBackUrl = design.printBack
    ? await ctx.storage.getUrl(design.printBack)
    : undefined

  const elements = await Promise.all(
    (design.elements || []).map(async (el: any) => ({
      ...el,
      imageUrl: el.fileId
        ? (await ctx.storage.getUrl(el.fileId)) || el.imageUrl
        : el.imageUrl,
    }))
  )

  return {
    ...design,
    id: design._id,
    previewFrontUrl,
    previewBackUrl,
    printFrontUrl,
    printBackUrl,
    elements,
  }
}

/**
 * Requête publique : retourne les modèles "À découvrir" sur l'accueil
 * Triés par mise en avant admin (featured), puis par nombre de likes et date de publication.
 */
export const getFeaturedDesigns = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const maxLimit = Math.min(args.limit ?? 8, 24)
    const published = await ctx.db
      .query('designs')
      .filter((q: any) => q.eq(q.field('status'), 'published'))
      .collect()

    const sorted = published.sort((a: any, b: any) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount
      return b.createdAt - a.createdAt
    })

    const sliced = sorted.slice(0, maxLimit)
    return await Promise.all(
      sliced.map((d: any) => hydrateDesignStorageUrls(ctx, d))
    )
  },
})

/**
 * Requête publique : liste tous les modèles publiés (équipe Maamfoogou + créateurs)
 */
export const listCatalogDesigns = query({
  args: {
    source: v.optional(
      v.union(v.literal('all'), v.literal('team'), v.literal('creator'))
    ),
  },
  handler: async (ctx, args) => {
    const published = await ctx.db
      .query('designs')
      .filter((q: any) => q.eq(q.field('status'), 'published'))
      .collect()

    const filtered =
      !args.source || args.source === 'all'
        ? published
        : published.filter((d: any) => d.source === args.source)

    const sorted = filtered.sort((a: any, b: any) => b.createdAt - a.createdAt)
    return await Promise.all(
      sorted.map((d: any) => hydrateDesignStorageUrls(ctx, d))
    )
  },
})

/**
 * Requête publique : détail complet d'un modèle par son identifiant
 */
export const getDesignById = query({
  args: { designId: v.id('designs') },
  handler: async (ctx, args) => {
    const design = await ctx.db.get(args.designId)
    if (!design) return null
    return await hydrateDesignStorageUrls(ctx, design)
  },
})

/**
 * Mutation protégée : génère une URL signée Convex File Storage pour uploader
 * les images originales, les aperçus 3D (toBlob) et les exports d'impression PNG transparents
 */
export const generateUploadUrl = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.sessionToken)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Mutation protégée (Section 7) : sauvegarde un design personnalisé avec positions normalisées (0 à 1)
 * et fichiers stockés dans Convex File Storage (jamais de base64).
 */
export const saveDesign = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.optional(v.id('designs')),
    name: v.string(),
    description: v.optional(v.string()),
    theme: v.optional(v.string()),
    tshirtColor: v.string(),
    size: v.optional(v.string()),
    status: v.union(v.literal('draft'), v.literal('published')),
    price: v.optional(v.number()),
    previewFront: v.optional(v.id('_storage')),
    previewBack: v.optional(v.id('_storage')),
    previewFrontUrl: v.optional(v.string()),
    previewBackUrl: v.optional(v.string()),
    printFront: v.optional(v.id('_storage')),
    printBack: v.optional(v.id('_storage')),
    elements: v.array(
      v.object({
        id: v.string(),
        side: v.union(v.literal('front'), v.literal('back')),
        type: v.union(v.literal('text'), v.literal('image')),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        rotation: v.number(),
        locked: v.optional(v.boolean()),
        text: v.optional(v.string()),
        font: v.optional(v.string()),
        fontSize: v.optional(v.number()),
        color: v.optional(v.string()),
        strokeColor: v.optional(v.string()),
        strokeWidth: v.optional(v.number()),
        fileId: v.optional(v.id('_storage')),
        imageUrl: v.optional(v.string()),
        mimeType: v.optional(v.string()),
        originalWidth: v.optional(v.number()),
        originalHeight: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)

    // Normalisation stricte (0..1) et validation des URLs
    const normalizedElements = args.elements.map((el) => {
      const cleanImageUrl = sanitizeSafeUrl(el.imageUrl)
      return {
        ...el,
        x: Math.max(0, Math.min(1, el.x)),
        y: Math.max(0, Math.min(1, el.y)),
        width: Math.max(0.02, Math.min(1, el.width)),
        height: Math.max(0.02, Math.min(1, el.height)),
        text: el.text ? sanitizeServerText(el.text, 120) : undefined,
        imageUrl: cleanImageUrl,
      }
    })

    const cleanName = sanitizeServerText(args.name || 'Mon Design Faso', 80)
    const cleanDesc = args.description
      ? sanitizeServerText(args.description, 300)
      : undefined

    if (args.designId) {
      const existing = await ctx.db.get(args.designId)
      if (!existing || existing.ownerId !== user._id) {
        throw new Error('Vous ne pouvez modifier que vos propres créations.')
      }

      await ctx.db.patch(args.designId, {
        name: cleanName,
        description: cleanDesc,
        theme: args.theme ?? existing.theme,
        tshirtColor: args.tshirtColor,
        size: args.size,
        status: args.status,
        price: args.price ?? existing.price ?? 12000,
        previewFront: args.previewFront ?? existing.previewFront,
        previewBack: args.previewBack ?? existing.previewBack,
        previewFrontUrl:
          sanitizeSafeUrl(args.previewFrontUrl) ?? existing.previewFrontUrl,
        previewBackUrl:
          sanitizeSafeUrl(args.previewBackUrl) ?? existing.previewBackUrl,
        printFront: args.printFront ?? existing.printFront,
        printBack: args.printBack ?? existing.printBack,
        elements: normalizedElements,
      })

      return { designId: args.designId, xpAwarded: 0 }
    }

    const newId = await ctx.db.insert('designs', {
      ownerId: user._id,
      creatorName: user.name,
      source: user.role === 'admin' ? 'team' : 'creator',
      name: cleanName,
      description: cleanDesc,
      theme: args.theme,
      tshirtColor: args.tshirtColor,
      size: args.size ?? 'L',
      status: args.status,
      price: args.price ?? 12000,
      featured: false,
      likesCount: 0,
      commentsCount: 0,
      previewFront: args.previewFront,
      previewBack: args.previewBack,
      previewFrontUrl: sanitizeSafeUrl(args.previewFrontUrl),
      previewBackUrl: sanitizeSafeUrl(args.previewBackUrl),
      printFront: args.printFront,
      printBack: args.printBack,
      elements: normalizedElements,
      createdAt: Date.now(),
    })

    const xp = await awardServerXp(ctx, user._id, 'design_saved', String(newId))
    return { designId: newId, xpAwarded: xp.points }
  },
})

/**
 * Requête protégée : alimente la page "Mes collections"
 * - Section 1 : Modèles créés par l'utilisateur
 * - Section 2 : Produits sauvegardés "À acheter plus tard" (alimentée automatiquement par les likes + état du stock)
 */
export const getMyCollections = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)

    // Section 1 : Créations de l'utilisateur
    const createdRaw = await ctx.db
      .query('designs')
      .withIndex('by_owner', (q: any) => q.eq('ownerId', user._id))
      .collect()

    const createdDesigns = await Promise.all(
      createdRaw
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .map((d: any) => hydrateDesignStorageUrls(ctx, d))
    )

    // Section 2 : Modèles likés ("À acheter plus tard") avec leur statut de stock en temps réel
    const userLikes = await ctx.db
      .query('likes')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .collect()

    const savedDesigns: Array<any> = []
    for (const like of userLikes.sort(
      (a: any, b: any) => b.createdAt - a.createdAt
    )) {
      const d = await ctx.db.get(like.designId)
      if (!d) continue
      const hydrated = await hydrateDesignStorageUrls(ctx, d)

      // Vérification du stock de la couleur/taille par défaut du modèle
      const targetSize = d.size || 'L'
      const stockRow = await ctx.db
        .query('stock')
        .withIndex('by_variant', (q: any) =>
          q.eq('color', d.tshirtColor).eq('size', targetSize)
        )
        .first()

      const available = stockRow
        ? Math.max(0, stockRow.quantity - stockRow.reserved)
        : 0

      let stockStatus: 'available' | 'low' | 'out_of_stock' = 'available'
      if (!stockRow || available === 0) {
        stockStatus = 'out_of_stock'
      } else if (available <= stockRow.lowThreshold) {
        stockStatus = 'low'
      }

      savedDesigns.push({
        ...hydrated,
        likedAt: like.createdAt,
        stockStatus,
        availableStock: available,
        restockDate: stockRow?.restockDate,
      })
    }

    return {
      createdDesigns,
      savedDesigns,
    }
  },
})

/**
 * Requête destinée au personnaliseur / atelier d'impression (Section 7) :
 * Renvoie pour une commande : couleur, taille, aperçus 3D, exports à plat PNG haute résolution
 * et la liste des éléments par côté (devant / dos) avec leurs coordonnées normalisées et images originales téléchargeables.
 */
export const getProductionSpecForOrder = query({
  args: { sessionToken: v.string(), orderId: v.id('orders') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    const order = await ctx.db.get(args.orderId)
    if (!order) throw new Error('Commande introuvable.')

    const design = await ctx.db.get(order.designId)
    if (!design) throw new Error('Design associé introuvable.')

    const hydrated = await hydrateDesignStorageUrls(ctx, design)

    return {
      orderId: order._id,
      status: order.status,
      color: order.color,
      size: order.size,
      quantity: order.quantity,
      previewFrontUrl: hydrated.previewFrontUrl,
      previewBackUrl: hydrated.previewBackUrl,
      printFrontUrl: hydrated.printFrontUrl,
      printBackUrl: hydrated.printBackUrl,
      frontElements: hydrated.elements.filter((el: any) => el.side === 'front'),
      backElements: hydrated.elements.filter((el: any) => el.side === 'back'),
    }
  },
})

/**
 * Permet à un admin de mettre en avant ("featured") un modèle sur l'accueil
 */
export const toggleFeaturedDesign = mutation({
  args: {
    sessionToken: v.string(),
    designId: v.id('designs'),
    featured: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    await ctx.db.patch(args.designId, { featured: args.featured })
    return { success: true }
  },
})
