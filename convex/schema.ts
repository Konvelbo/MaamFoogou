import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Schéma complet Convex pour Maamfoogou (Burkina Faso & Sous-Région)
export default defineSchema({
  // 1. Utilisateurs & Rôles ("admin" | "user")
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    phone: v.string(),
    geoCoordinates: v.object({
      city: v.string(),
      district: v.string(),
      landmark: v.string(),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
    }),
    role: v.union(v.literal('admin'), v.literal('user')),
    referralCode: v.string(),
    referredByUserId: v.optional(v.id('users')),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_referral_code', ['referralCode']),

  // Sessions d'authentification
  sessions: defineTable({
    userId: v.id('users'),
    token: v.string(),
    expiresAt: v.number(),
  }).index('by_token', ['token']),

  // 7. Stockage des designs personnalisés et des modèles du catalogue
  designs: defineTable({
    ownerId: v.id('users'),
    creatorName: v.string(),
    source: v.union(v.literal('team'), v.literal('creator')),
    name: v.string(),
    description: v.optional(v.string()),
    theme: v.optional(v.string()),
    tshirtColor: v.string(),
    size: v.optional(v.string()),
    status: v.union(v.literal('draft'), v.literal('published')),
    price: v.optional(v.number()), // Prix en FCFA
    featured: v.boolean(),
    likesCount: v.number(),
    commentsCount: v.number(),
    allowRemix: v.optional(v.boolean()), // Autoriser d'autres utilisateurs à remixer/personnaliser (copie)
    parentDesignId: v.optional(v.id('designs')), // Traçabilité du modèle original si c'est un remix
    parentDesignName: v.optional(v.string()),
    parentCreatorName: v.optional(v.string()),
    // Fichiers Convex File Storage (aperçus 3D face/dos + exports d'impression haute résolution sans t-shirt)
    previewFront: v.optional(v.id('_storage')),
    previewBack: v.optional(v.id('_storage')),
    previewFrontUrl: v.optional(v.string()),
    previewBackUrl: v.optional(v.string()),
    printFront: v.optional(v.id('_storage')),
    printBack: v.optional(v.id('_storage')),
    colorVariants: v.optional(
      v.array(
        v.object({
          color: v.string(),
          label: v.string(),
          previewUrl: v.optional(v.string()),
        })
      )
    ),
    // Éléments normalisés (0 à 1) sur la zone d'impression
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
        // Champs texte
        text: v.optional(v.string()),
        font: v.optional(v.string()),
        fontSize: v.optional(v.number()),
        color: v.optional(v.string()),
        strokeColor: v.optional(v.string()),
        strokeWidth: v.optional(v.number()),
        // Champs image (fileId dans Convex Storage, jamais de base64 stocké dans un document)
        fileId: v.optional(v.id('_storage')),
        imageUrl: v.optional(v.string()),
        mimeType: v.optional(v.string()),
        originalWidth: v.optional(v.number()),
        originalHeight: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_status_and_featured', ['status', 'featured']),

  // 5. Likes & Collection automatique "À acheter plus tard"
  likes: defineTable({
    userId: v.id('users'),
    designId: v.id('designs'),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_design', ['designId'])
    .index('by_user_and_design', ['userId', 'designId']),

  // 6. Commentaires en temps réel & Modération
  comments: defineTable({
    designId: v.id('designs'),
    userId: v.id('users'),
    text: v.string(),
    parentId: v.optional(v.id('comments')),
    photoStorageId: v.optional(v.id('_storage')),
    photoUrl: v.optional(v.string()),
    status: v.union(
      v.literal('visible'),
      v.literal('hidden'),
      v.literal('reported')
    ),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index('by_design', ['designId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt'])
    .index('by_status', ['status', 'createdAt']),

  // 8. Gestion des stocks par variante (couleur + taille)
  stock: defineTable({
    color: v.string(),
    colorName: v.string(),
    size: v.string(),
    quantity: v.number(), // Stock physique réel
    reserved: v.number(), // En cours de paiement (pending)
    lowThreshold: v.number(), // Défaut : 5
    restockDate: v.optional(v.string()),
  }).index('by_variant', ['color', 'size']),

  // Commandes & Réservations de stock
  orders: defineTable({
    userId: v.id('users'),
    designId: v.id('designs'),
    color: v.string(),
    size: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    totalAmount: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('paid'),
      v.literal('failed'),
      v.literal('expired')
    ),
    paymentProvider: v.string(), // ex: "orange_money_bf" | "moov_money_bf"
    paymentReference: v.string(),
    phoneNumber: v.string(),
    deliveryInfo: v.object({
      fullName: v.string(),
      phone: v.string(),
      city: v.string(),
      district: v.string(),
      landmark: v.string(),
    }),
    referralCodeUsed: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index('by_user', ['userId', 'createdAt'])
    .index('by_status', ['status', 'createdAt'])
    .index('by_payment_reference', ['paymentReference']),

  // 10.A Liens de partage par produit (/p/{designId}?ref={code})
  shareLinks: defineTable({
    code: v.string(),
    userId: v.id('users'),
    designId: v.id('designs'),
    clicksCount: v.number(),
    purchasesCount: v.number(),
    createdAt: v.number(),
  })
    .index('by_code', ['code'])
    .index('by_user_and_design', ['userId', 'designId']),

  // 10.D Événements de clics trackés (avec empreinte appareil et anti-fraude)
  trackingClicks: defineTable({
    code: v.string(),
    referrerId: v.id('users'),
    designId: v.optional(v.id('designs')),
    deviceFingerprint: v.string(),
    dayKey: v.string(),
    createdAt: v.number(),
  })
    .index('by_code_and_fingerprint', ['code', 'deviceFingerprint', 'dayKey'])
    .index('by_referrer_and_day', ['referrerId', 'dayKey']),

  // 10.D Achats attribués via un lien de partage
  attributedPurchases: defineTable({
    referrerId: v.id('users'),
    buyerId: v.id('users'),
    orderId: v.id('orders'),
    designId: v.id('designs'),
    status: v.union(
      v.literal('pending'),
      v.literal('validated'),
      v.literal('cancelled')
    ),
    createdAt: v.number(),
    validatedAt: v.optional(v.number()),
  })
    .index('by_order', ['orderId'])
    .index('by_referrer', ['referrerId']),

  // 10.B & 10.D Parrainages d'amis (/signup?ref=CODE)
  referrals: defineTable({
    referrerId: v.id('users'),
    refereeId: v.id('users'),
    status: v.union(v.literal('registered'), v.literal('rewarded')),
    createdAt: v.number(),
    rewardedAt: v.optional(v.number()),
  })
    .index('by_referee', ['refereeId'])
    .index('by_referrer', ['referrerId']),

  // 9. Événements d'XP (source de vérité immuable du calcul des niveaux 1 à 100)
  xpEvents: defineTable({
    userId: v.id('users'),
    action: v.string(),
    domain: v.union(
      v.literal('achats'),
      v.literal('partage'),
      v.literal('creation'),
      v.literal('communaute')
    ),
    points: v.number(),
    date: v.number(),
    dayKey: v.string(),
    reference: v.optional(v.string()),
  })
    .index('by_user', ['userId', 'date'])
    .index('by_user_and_day', ['userId', 'dayKey']),
})
