import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { hashPassword } from './helpers'

export const generateSeedUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

const CATALOG_COLORS = [
  { color: '#111111', colorName: 'Noir Absolu' },
  { color: '#F5F5F5', colorName: 'Blanc Coton du Faso' },
  { color: '#FFFFFF', colorName: 'Blanc Pur' },
  { color: '#9CA3AF', colorName: 'Gris Chiné' },
  { color: '#4B5320', colorName: 'Vert Armée' },
  { color: '#1E293B', colorName: 'Bleu Nuit' },
  { color: '#1D4ED8', colorName: 'Bleu Roi' },
  { color: '#38BDF8', colorName: 'Bleu Ciel' },
  { color: '#C2410C', colorName: 'Terre de Sienne' },
  { color: '#DC2626', colorName: 'Rouge Vif' },
  { color: '#7F1D1D', colorName: 'Bordeaux' },
  { color: '#14532D', colorName: 'Vert Forêt' },
  { color: '#10B981', colorName: 'Vert Émeraude' },
  { color: '#F59E0B', colorName: 'Or du Lobi' },
  { color: '#EA580C', colorName: 'Orange Sahel' },
  { color: '#D6D3D1', colorName: 'Beige Sable' },
  { color: '#78350F', colorName: 'Marron Café' },
  { color: '#581C87', colorName: 'Violet Impérial' },
]

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const seedDatabase = mutation({
  args: {
    storageIds: v.object({
      celineTriomphe: v.id('_storage'),
      palmAngelsLogo: v.id('_storage'),
      gucciCrest: v.id('_storage'),
      akatsukiCloud: v.id('_storage'),
      sharingan: v.id('_storage'),
      tacticalSkull: v.id('_storage'),
      emojiJoy: v.id('_storage'),
      hipHopCrown: v.id('_storage'),
    }),
  },
  handler: async (ctx, { storageIds }) => {
    // 1. Nettoyage complet des tables existantes pour garantir 0 donnée obsolète
    const tablesToClear = [
      'designs',
      'likes',
      'comments',
      'stock',
      'orders',
      'shareLinks',
      'trackingClicks',
      'attributedPurchases',
      'referrals',
      'xpEvents',
      'sessions',
      'users',
    ] as const

    for (const table of tablesToClear) {
      const rows = await ctx.db.query(table).collect()
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
    }

    const now = Date.now()
    const adminPassHash = await hashPassword('Admin3D!2026')
    const creatorPassHash = await hashPassword('Creator!2026')

    // 2. Création des comptes dans Convex (mots de passe hachés SHA-256 + sel)
    const adminId = await ctx.db.insert('users', {
      name: 'Atelier Maamfoogou',
      email: 'admin@maamfoogou.bf',
      passwordHash: adminPassHash,
      phone: '+226 70 10 20 30',
      geoCoordinates: {
        city: 'Ouagadougou',
        district: 'Ouaga 2000',
        landmark: 'Avenue Pascal Zagré',
        lat: 12.3184,
        lng: -1.5122,
      },
      role: 'admin',
      referralCode: 'MFO-ADM1',
      createdAt: now - 86400000 * 30,
    })

    const creatorAminataId = await ctx.db.insert('users', {
      name: 'Aminata Ouédraogo',
      email: 'aminata@createur.bf',
      passwordHash: creatorPassHash,
      phone: '+226 76 44 55 66',
      geoCoordinates: {
        city: 'Bobo-Dioulasso',
        district: 'Sarfalao',
        landmark: 'Près du grand marché',
        lat: 11.1771,
        lng: -4.2979,
      },
      role: 'user',
      referralCode: 'AMI-226X',
      createdAt: now - 86400000 * 18,
    })

    const creatorIdrissaId = await ctx.db.insert('users', {
      name: 'Idrissa Kaboré',
      email: 'idrissa@createur.bf',
      passwordHash: creatorPassHash,
      phone: '+226 65 88 99 00',
      geoCoordinates: {
        city: 'Ouagadougou',
        district: 'Zogona',
        landmark: 'Face Université Joseph Ki-Zerbo',
        lat: 12.3768,
        lng: -1.4981,
      },
      role: 'user',
      referralCode: 'IDR-FASO',
      createdAt: now - 86400000 * 12,
    })

    // 3. Initialisation de la table stock dans Convex
    for (const c of CATALOG_COLORS) {
      for (const size of SIZES) {
        let quantity = 25
        let restockDate: string | undefined = undefined
        if (c.color === '#C2410C' && size === 'XL') {
          quantity = 0
          restockDate = '28/11/2026'
        } else if (c.color === '#14532D' && size === 'M') {
          quantity = 3
        } else if (c.color === '#F59E0B' && size === 'L') {
          quantity = 4
        }

        await ctx.db.insert('stock', {
          color: c.color,
          colorName: c.colorName,
          size,
          quantity,
          reserved: 0,
          lowThreshold: 5,
          restockDate,
        })
      }
    }

    // 4. Insertion des 8 modèles de présentation variés dans la table `designs` Convex
    // Modèle 1 : Marque Luxe CELINE (Devant uniquement — Mélange Image sans fond + Texte)
    const d1 = await ctx.db.insert('designs', {
      ownerId: adminId,
      creatorName: 'Atelier Maamfoogou',
      source: 'team',
      name: 'CELINE PARIS — Édition Triomphe',
      description:
        'Coupe droite minimaliste sur coton lourd noir. Emblème Triomphe sans fond et typographie haute couture CELINE PARIS sur le devant, dos épuré.',
      theme: 'luxury',
      tshirtColor: '#111111',
      size: 'L',
      status: 'published',
      price: 15000,
      featured: true,
      likesCount: 48,
      commentsCount: 2,
      elements: [
        {
          id: 'celine-logo-front',
          side: 'front',
          type: 'image',
          x: 0.5,
          y: 0.34,
          width: 0.3,
          height: 0.3,
          rotation: 0,
          fileId: storageIds.celineTriomphe,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'celine-text-front',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.55,
          width: 0.36,
          height: 0.1,
          rotation: 0,
          text: 'CELINE',
          font: 'Playfair Display',
          fontSize: 44,
          color: '#FFFFFF',
        },
        {
          id: 'celine-sub-front',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.65,
          width: 0.22,
          height: 0.06,
          rotation: 0,
          text: 'PARIS',
          font: 'Plus Jakarta Sans',
          fontSize: 22,
          color: '#D4AF37',
        },
      ],
      createdAt: now - 3600000 * 1,
    })

    // Modèle 2 : Marque Streetwear PALM ANGELS (Devant + Dos simultanément — Texte devant + Image sans fond & Texte au dos)
    const d2 = await ctx.db.insert('designs', {
      ownerId: adminId,
      creatorName: 'Atelier Maamfoogou',
      source: 'team',
      name: 'PALM ANGELS — Gothic Back Print',
      description:
        'Signature gothique Palm Angels sur le col avant et maxi impression palmier détouré sans fond + lettrage gothique au dos.',
      theme: 'luxury',
      tshirtColor: '#F5F5F5',
      size: 'L',
      status: 'published',
      price: 16500,
      featured: true,
      likesCount: 62,
      commentsCount: 1,
      elements: [
        {
          id: 'pa-front-collar',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.29,
          width: 0.28,
          height: 0.08,
          rotation: 0,
          text: 'Palm Angels',
          font: 'UnifrakturMaguntia',
          fontSize: 32,
          color: '#111111',
        },
        {
          id: 'pa-back-palm',
          side: 'back',
          type: 'image',
          x: 0.5,
          y: 0.38,
          width: 0.38,
          height: 0.38,
          rotation: 0,
          fileId: storageIds.palmAngelsLogo,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'pa-back-gothic',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.63,
          width: 0.4,
          height: 0.11,
          rotation: 0,
          text: 'Palm Angels',
          font: 'UnifrakturMaguntia',
          fontSize: 46,
          color: '#111111',
        },
      ],
      createdAt: now - 3600000 * 2,
    })

    // Modèle 3 : Marque Luxe GUCCI (Devant Image sans fond uniquement + Dos Texte & Numéro)
    const d3 = await ctx.db.insert('designs', {
      ownerId: adminId,
      creatorName: 'Atelier Maamfoogou',
      source: 'team',
      name: 'GUCCI — Blind For Love XXV',
      description:
        'Emblème GG entrelacé sur bande Web vert-rouge-vert détourée sans fond à l’avant, et inscription royale BLIND FOR LOVE XXV au dos.',
      theme: 'luxury',
      tshirtColor: '#FFFFFF',
      size: 'M',
      status: 'published',
      price: 16000,
      featured: true,
      likesCount: 54,
      commentsCount: 1,
      elements: [
        {
          id: 'gucci-front-emblem',
          side: 'front',
          type: 'image',
          x: 0.5,
          y: 0.42,
          width: 0.38,
          height: 0.38,
          rotation: 0,
          fileId: storageIds.gucciCrest,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'gucci-back-title',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.34,
          width: 0.36,
          height: 0.09,
          rotation: 0,
          text: 'BLIND FOR LOVE',
          font: 'Cinzel',
          fontSize: 34,
          color: '#B91C1C',
        },
        {
          id: 'gucci-back-num',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.5,
          width: 0.3,
          height: 0.12,
          rotation: 0,
          text: 'XXV',
          font: 'Playfair Display',
          fontSize: 52,
          color: '#14532D',
        },
      ],
      createdAt: now - 3600000 * 3,
    })

    // Modèle 4 : Thème ANIMÉ / MANGA (Devant + Dos simultanément — Nuage Akatsuki devant + Sharingan & Kanji au dos)
    const d4 = await ctx.db.insert('designs', {
      ownerId: creatorIdrissaId,
      creatorName: 'Idrissa Kaboré',
      source: 'creator',
      name: 'AKATSUKI SHINOBI — Édition Manga',
      description:
        'Thème Animé japonais : nuage rouge Akatsuki sans fond sur le torse et Mangekyou Sharingan géant + lettrage AKATSUKI dans le dos.',
      theme: 'anime',
      tshirtColor: '#111111',
      size: 'L',
      status: 'published',
      price: 13500,
      featured: true,
      likesCount: 71,
      commentsCount: 2,
      elements: [
        {
          id: 'anime-front-cloud',
          side: 'front',
          type: 'image',
          x: 0.5,
          y: 0.38,
          width: 0.34,
          height: 0.34,
          rotation: 0,
          fileId: storageIds.akatsukiCloud,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'anime-back-sharingan',
          side: 'back',
          type: 'image',
          x: 0.5,
          y: 0.37,
          width: 0.36,
          height: 0.36,
          rotation: 0,
          fileId: storageIds.sharingan,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'anime-back-text',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.62,
          width: 0.36,
          height: 0.1,
          rotation: 0,
          text: 'AKATSUKI 暁',
          font: 'Oswald',
          fontSize: 42,
          color: '#EF4444',
        },
      ],
      createdAt: now - 3600000 * 4,
    })

    // Modèle 5 : Thème LA GUERRE / TACTICAL (Dos uniquement — Mélange Image sans fond + Texte pochoir militaire)
    const d5 = await ctx.db.insert('designs', {
      ownerId: creatorIdrissaId,
      creatorName: 'Idrissa Kaboré',
      source: 'creator',
      name: 'GHOST RECON — Opération Tactique',
      description:
        'Thème Guerre & Forces Spéciales : face avant sobre sans marquage, dos imprimé avec l’emblème Crâne Ailé Tactique sans fond et matricule TASK FORCE 226.',
      theme: 'guerre',
      tshirtColor: '#4B5320',
      size: 'XL',
      status: 'published',
      price: 13000,
      featured: true,
      likesCount: 39,
      commentsCount: 1,
      elements: [
        {
          id: 'war-back-skull',
          side: 'back',
          type: 'image',
          x: 0.5,
          y: 0.37,
          width: 0.38,
          height: 0.38,
          rotation: 0,
          fileId: storageIds.tacticalSkull,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'war-back-title',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.63,
          width: 0.38,
          height: 0.1,
          rotation: 0,
          text: 'TASK FORCE 226',
          font: 'Bebas Neue',
          fontSize: 44,
          color: '#FACC15',
        },
      ],
      createdAt: now - 3600000 * 5,
    })

    // Modèle 6 : Thème LA JOIE / EMOJI (Devant + Dos simultanément — Emoji sans fond devant + Typographie Pop au dos)
    const d6 = await ctx.db.insert('designs', {
      ownerId: creatorAminataId,
      creatorName: 'Aminata Ouédraogo',
      source: 'creator',
      name: 'PURE JOIE — Emoji Dopamine Club',
      description:
        'Thème La Joie : composition d’emojis souriants et étincelles détourés sans fond sur le devant, manifeste GOOD VIBES ONLY au dos.',
      theme: 'joie',
      tshirtColor: '#FFFFFF',
      size: 'M',
      status: 'published',
      price: 12000,
      featured: true,
      likesCount: 44,
      commentsCount: 1,
      elements: [
        {
          id: 'joy-front-emoji',
          side: 'front',
          type: 'image',
          x: 0.5,
          y: 0.4,
          width: 0.38,
          height: 0.38,
          rotation: 0,
          fileId: storageIds.emojiJoy,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'joy-back-main',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.36,
          width: 0.38,
          height: 0.1,
          rotation: 0,
          text: 'GOOD VIBES ONLY',
          font: 'Righteous',
          fontSize: 40,
          color: '#111111',
        },
        {
          id: 'joy-back-sub',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.52,
          width: 0.34,
          height: 0.08,
          rotation: 0,
          text: 'PURE JOIE • 226',
          font: 'Syne',
          fontSize: 30,
          color: '#EA580C',
        },
      ],
      createdAt: now - 3600000 * 6,
    })

    // Modèle 7 : Thème LE RAP / HIP-HOP (Devant + Dos simultanément — Couronne & Micro sans fond devant + Typo Rap au dos)
    const d7 = await ctx.db.insert('designs', {
      ownerId: creatorAminataId,
      creatorName: 'Aminata Ouédraogo',
      source: 'creator',
      name: '226 HIP-HOP — Légendes du Rap',
      description:
        'Thème Le Rap : couronne dorée, micro studio et badge Parental Advisory sans fond sur la poitrine, lettrage STRAIGHT OUTTA OUAGA au dos.',
      theme: 'rap',
      tshirtColor: '#111111',
      size: 'L',
      status: 'published',
      price: 14000,
      featured: true,
      likesCount: 59,
      commentsCount: 1,
      elements: [
        {
          id: 'rap-front-crown',
          side: 'front',
          type: 'image',
          x: 0.5,
          y: 0.4,
          width: 0.36,
          height: 0.36,
          rotation: 0,
          fileId: storageIds.hipHopCrown,
          mimeType: 'image/svg+xml',
        },
        {
          id: 'rap-back-top',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.34,
          width: 0.38,
          height: 0.1,
          rotation: 0,
          text: 'STRAIGHT OUTTA',
          font: 'Anton',
          fontSize: 42,
          color: '#FFFFFF',
        },
        {
          id: 'rap-back-bottom',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.5,
          width: 0.4,
          height: 0.1,
          rotation: 0,
          text: 'OUAGADOUGOU',
          font: 'Anton',
          fontSize: 44,
          color: '#F59E0B',
        },
      ],
      createdAt: now - 3600000 * 7,
    })

    // Modèle 8 : Typographie Architecturale Pure (Devant uniquement — Texte seul)
    await ctx.db.insert('designs', {
      ownerId: adminId,
      creatorName: 'Atelier Maamfoogou',
      source: 'team',
      name: 'MANIFESTE 226 — Typographie Pure',
      description:
        'Édition 100% typographique sur coton gris chiné. Marquage architectural haute densité sur le devant, dos minimaliste.',
      theme: 'luxury',
      tshirtColor: '#9CA3AF',
      size: 'M',
      status: 'published',
      price: 11500,
      featured: true,
      likesCount: 31,
      commentsCount: 0,
      elements: [
        {
          id: 'typo-front-1',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.36,
          width: 0.36,
          height: 0.09,
          rotation: 0,
          text: 'MAISON TEXTILE',
          font: 'Space Grotesk',
          fontSize: 36,
          color: '#111111',
        },
        {
          id: 'typo-front-2',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.5,
          width: 0.4,
          height: 0.11,
          rotation: 0,
          text: 'MAAMFOOGOU',
          font: 'Bebas Neue',
          fontSize: 48,
          color: '#111111',
        },
      ],
      createdAt: now - 3600000 * 8,
    })

    // 5. Quelques commentaires réels en base Convex
    await ctx.db.insert('comments', {
      designId: d1,
      userId: creatorAminataId,
      text: 'Le rendu de l’emblème Triomphe sans fond sur le coton noir est ultra propre.',
      status: 'visible',
      createdAt: now - 1800000 * 5,
    })
    await ctx.db.insert('comments', {
      designId: d1,
      userId: creatorIdrissaId,
      text: 'Reçu à Ouaga 2000 en 24h, la coupe et l’impression sont dignes d’une grande maison.',
      status: 'visible',
      createdAt: now - 1800000 * 2,
    })
    await ctx.db.insert('comments', {
      designId: d2,
      userId: creatorAminataId,
      text: 'Le dos Palm Angels rend super bien en 3D comme en vrai !',
      status: 'visible',
      createdAt: now - 1800000 * 4,
    })
    await ctx.db.insert('comments', {
      designId: d3,
      userId: creatorIdrissaId,
      text: 'Les couleurs Gucci sur le t-shirt blanc ressortent parfaitement.',
      status: 'visible',
      createdAt: now - 1800000 * 3,
    })
    await ctx.db.insert('comments', {
      designId: d4,
      userId: creatorAminataId,
      text: 'Incroyable le combo nuage Akatsuki devant et Sharingan dans le dos !',
      status: 'visible',
      createdAt: now - 1800000 * 2,
    })
    await ctx.db.insert('comments', {
      designId: d4,
      userId: adminId,
      text: 'Merci ! Toutes les illustrations sont détourées sans fond pour une impression directe sur fibre.',
      status: 'visible',
      createdAt: now - 1800000 * 1,
    })
    await ctx.db.insert('comments', {
      designId: d5,
      userId: creatorAminataId,
      text: 'Le vert armée avec le crâne tactique dans le dos est pépite.',
      status: 'visible',
      createdAt: now - 1800000 * 2,
    })
    await ctx.db.insert('comments', {
      designId: d6,
      userId: creatorIdrissaId,
      text: 'Super lumineux ce modèle Emoji Joie !',
      status: 'visible',
      createdAt: now - 1800000 * 1,
    })
    await ctx.db.insert('comments', {
      designId: d7,
      userId: creatorIdrissaId,
      text: 'Le classique Hip-Hop 226, incontournable.',
      status: 'visible',
      createdAt: now - 1800000 * 1,
    })

    // 6. XP initial pour les comptes créés
    await ctx.db.insert('xpEvents', {
      userId: adminId,
      action: 'account_created',
      domain: 'communaute',
      points: 50,
      date: now - 86400000 * 30,
      dayKey: '2026-09-17',
      reference: 'welcome',
    })
    await ctx.db.insert('xpEvents', {
      userId: creatorAminataId,
      action: 'account_created',
      domain: 'communaute',
      points: 50,
      date: now - 86400000 * 18,
      dayKey: '2026-09-29',
      reference: 'welcome',
    })
    await ctx.db.insert('xpEvents', {
      userId: creatorIdrissaId,
      action: 'account_created',
      domain: 'communaute',
      points: 50,
      date: now - 86400000 * 12,
      dayKey: '2026-10-05',
      reference: 'welcome',
    })

    return {
      seeded: true,
      designsCount: 8,
    }
  },
})
