import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireAdmin } from './helpers'

export type StockCheckStatus =
  | 'available'
  | 'low'
  | 'partial'
  | 'out_of_stock'
  | 'unavailable'

/**
 * Calcule le statut de stock exact côté serveur pour une variante et une quantité demandée
 */
export function evaluateVariantStock(
  row: {
    quantity: number
    reserved: number
    lowThreshold: number
    restockDate?: string
  } | null,
  requestedQuantity = 1
): {
  status: StockCheckStatus
  available: number
  quantity: number
  reserved: number
  lowThreshold: number
  restockDate?: string
  message: string | null
} {
  if (!row) {
    return {
      status: 'unavailable',
      available: 0,
      quantity: 0,
      reserved: 0,
      lowThreshold: 5,
      message: "Cette couleur n'existe pas",
    }
  }

  const available = Math.max(0, row.quantity - row.reserved)
  const threshold = row.lowThreshold ?? 5

  if (available === 0) {
    const restockText = row.restockDate
      ? ` • Disponible à partir du ${row.restockDate}`
      : ''
    return {
      status: 'out_of_stock',
      available: 0,
      quantity: row.quantity,
      reserved: row.reserved,
      lowThreshold: threshold,
      restockDate: row.restockDate,
      message: `Rupture de stock${restockText}`,
    }
  }

  if (available < requestedQuantity) {
    return {
      status: 'partial',
      available,
      quantity: row.quantity,
      reserved: row.reserved,
      lowThreshold: threshold,
      restockDate: row.restockDate,
      message: `Seulement ${available} disponible${available > 1 ? 's' : ''}`,
    }
  }

  if (available <= threshold) {
    return {
      status: 'low',
      available,
      quantity: row.quantity,
      reserved: row.reserved,
      lowThreshold: threshold,
      restockDate: row.restockDate,
      message: `Plus que ${available} en stock`,
    }
  }

  return {
    status: 'available',
    available,
    quantity: row.quantity,
    reserved: row.reserved,
    lowThreshold: threshold,
    restockDate: row.restockDate,
    message: null,
  }
}

/**
 * Requête publique (Section 8) :
 * Vérifie la disponibilité d'une variante (couleur + taille) pour une quantité demandée.
 */
export const checkStock = query({
  args: {
    color: v.string(),
    size: v.string(),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('stock')
      .withIndex('by_variant', (q: any) =>
        q.eq('color', args.color).eq('size', args.size)
      )
      .first()

    return evaluateVariantStock(row, Math.max(1, args.quantity))
  },
})

/**
 * Requête publique (Section 8) :
 * Renvoie toutes les variantes (couleurs et tailles) avec leur statut calculé côté serveur
 * afin de griser automatiquement les indisponibles dans l'interface.
 */
export const getAvailableVariants = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('stock').collect()

    return rows.map((row: any) => {
      const evaluated = evaluateVariantStock(row, 1)
      return {
        id: row._id,
        color: row.color,
        colorName: row.colorName,
        size: row.size,
        ...evaluated,
      }
    })
  },
})

/**
 * Requête Admin : variantes dont le stock disponible est inférieur ou égal au seuil d'alerte
 */
export const getLowStock = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    const rows = await ctx.db.query('stock').collect()

    return rows
      .map((row: any) => ({
        id: row._id,
        color: row.color,
        colorName: row.colorName,
        size: row.size,
        ...evaluateVariantStock(row, 1),
      }))
      .filter((v: any) => v.available <= v.lowThreshold)
      .sort((a: any, b: any) => a.available - b.available)
  },
})

/**
 * Mutation Admin (Section 8) :
 * REMPLACE la quantité réelle et met à jour la date de réapprovisionnement (corrections d'inventaire / rupture).
 */
export const updateStock = mutation({
  args: {
    sessionToken: v.string(),
    color: v.string(),
    colorName: v.optional(v.string()),
    size: v.string(),
    quantity: v.number(),
    lowThreshold: v.optional(v.number()),
    restockDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    const existing = await ctx.db
      .query('stock')
      .withIndex('by_variant', (q: any) =>
        q.eq('color', args.color).eq('size', args.size)
      )
      .first()

    const cleanQuantity = Math.max(0, Math.floor(args.quantity))

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: cleanQuantity,
        lowThreshold: args.lowThreshold ?? existing.lowThreshold,
        restockDate: args.restockDate,
      })
      return { id: existing._id }
    }

    const newId = await ctx.db.insert('stock', {
      color: args.color,
      colorName: args.colorName || args.color,
      size: args.size,
      quantity: cleanQuantity,
      reserved: 0,
      lowThreshold: args.lowThreshold ?? 5,
      restockDate: args.restockDate,
    })

    return { id: newId }
  },
})

/**
 * Mutation Admin (Section 8) :
 * Ajoute n unités au stock réel (quantity += n) pour les réapprovisionnements sans écraser les ventes en cours.
 */
export const addStock = mutation({
  args: {
    sessionToken: v.string(),
    color: v.string(),
    size: v.string(),
    addedQuantity: v.number(),
    restockDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken)
    const existing = await ctx.db
      .query('stock')
      .withIndex('by_variant', (q: any) =>
        q.eq('color', args.color).eq('size', args.size)
      )
      .first()

    if (!existing) {
      throw new Error('Variante de stock introuvable.')
    }

    const nextQuantity = Math.max(
      0,
      existing.quantity + Math.floor(args.addedQuantity)
    )

    await ctx.db.patch(existing._id, {
      quantity: nextQuantity,
      restockDate:
        nextQuantity > existing.reserved ? undefined : args.restockDate,
    })

    return { quantity: nextQuantity }
  },
})
