import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import {
  awardServerXp,
  computeUserXpSummary,
  generateSecureToken,
  hashPassword,
  requireUser,
  sanitizeServerText,
  verifyPassword,
} from './helpers'

function generateShortReferralCode(name: string): string {
  const prefix =
    name
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 3) || 'MFO'
  const randomBytes = new Uint8Array(3)
  crypto.getRandomValues(randomBytes)
  const suffix = Array.from(randomBytes)
    .map((b) => b.toString(36).toUpperCase())
    .join('')
    .slice(0, 4)
  return `${prefix}-${suffix}`
}

/**
 * Inscription ou Connexion d'un utilisateur Maamfoogou.
 * Attribue le parrainage éventuel (?ref=CODE) et verse l'XP de bienvenue à la création.
 */
export const authenticate = mutation({
  args: {
    mode: v.union(v.literal('login'), v.literal('register')),
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    district: v.optional(v.string()),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = sanitizeServerText(args.email, 120).toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Adresse email invalide.')
    }
    if (!args.password || args.password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères.')
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q: any) => q.eq('email', cleanEmail))
      .first()

    let user = existingUser

    if (args.mode === 'login') {
      if (!user) {
        throw new Error('Email ou mot de passe incorrect.')
      }
      const isValid = await verifyPassword(args.password, user.passwordHash)
      if (!isValid) {
        throw new Error('Email ou mot de passe incorrect.')
      }
    } else {
      if (user) {
        throw new Error(
          'Un compte existe déjà avec cet email. Connectez-vous.'
        )
      }

      const cleanName = sanitizeServerText(args.name || 'Membre Maamfoogou', 60)
      const cleanPhone = sanitizeServerText(args.phone || '+226 70 00 00 00', 25)
      const cleanCity = sanitizeServerText(args.city || 'Ouagadougou', 50)
      const cleanDistrict = sanitizeServerText(
        args.district || 'Koulouba / Zone 1',
        60
      )

      // Recherche du parrain éventuel si un code ?ref= a été conservé
      let referredByUserId: any = undefined
      if (args.referralCode) {
        const refOwner = await ctx.db
          .query('users')
          .withIndex('by_referral_code', (q: any) =>
            q.eq('referralCode', args.referralCode!.trim().toUpperCase())
          )
          .first()

        if (refOwner && refOwner.email !== cleanEmail) {
          referredByUserId = refOwner._id
        }
      }

      const passwordHash = await hashPassword(args.password)

      const newUserId = await ctx.db.insert('users', {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        phone: cleanPhone,
        geoCoordinates: {
          city: cleanCity,
          district: cleanDistrict,
          landmark: 'Près du goudron principal',
        },
        role: 'user',
        referralCode: generateShortReferralCode(cleanName),
        referredByUserId,
        createdAt: Date.now(),
      })

      // Enregistrement du lien de parrainage (l'XP du parrain sera versé au 1er achat confirmé du filleul)
      if (referredByUserId) {
        await ctx.db.insert('referrals', {
          referrerId: referredByUserId,
          refereeId: newUserId,
          status: 'registered',
          createdAt: Date.now(),
        })
      }

      // Attribution côté serveur de l'XP de création de compte
      await awardServerXp(ctx, newUserId, 'account_created', 'welcome')

      user = await ctx.db.get(newUserId)
    }

    if (!user) {
      throw new Error('Erreur lors de la récupération du profil.')
    }

    const token = generateSecureToken('mf_sess', 24)
    await ctx.db.insert('sessions', {
      userId: user._id,
      token,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 jours
    })

    const xpSummary = await computeUserXpSummary(ctx, user._id)

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        geoCoordinates: user.geoCoordinates,
        role: user.role,
        referralCode: user.referralCode,
        ...xpSummary,
      },
    }
  },
})

/**
 * Mutation protégée : synchronise un compte connecté via Clerk (ex: Google OAuth)
 * et génère la session Convex locale avec attribution du parrainage et des points d'XP.
 */
export const syncClerkUser = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = sanitizeServerText(args.email, 120).toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Adresse email invalide.')
    }

    let user = await ctx.db
      .query('users')
      .withIndex('by_email', (q: any) => q.eq('email', cleanEmail))
      .first()

    if (!user) {
      let referredByUserId: any = undefined
      if (args.referralCode) {
        const refOwner = await ctx.db
          .query('users')
          .withIndex('by_referral_code', (q: any) =>
            q.eq('referralCode', args.referralCode!.trim().toUpperCase())
          )
          .first()
        if (refOwner && refOwner.email !== cleanEmail) {
          referredByUserId = refOwner._id
        }
      }

      const cleanName = sanitizeServerText(args.name || 'Membre Clerk', 60)
      const newUserId = await ctx.db.insert('users', {
        clerkUserId: args.clerkUserId,
        name: cleanName,
        email: cleanEmail,
        passwordHash: 'clerk_authenticated_oauth',
        phone: '+226 70 00 00 00',
        geoCoordinates: {
          city: 'Ouagadougou',
          district: 'Centre / Zone 1',
          landmark: 'Connexion Clerk Google',
        },
        role: 'user',
        referralCode: generateShortReferralCode(cleanName),
        referredByUserId,
        avatarUrl: args.avatarUrl,
        createdAt: Date.now(),
      })

      if (referredByUserId) {
        await ctx.db.insert('referrals', {
          referrerId: referredByUserId,
          refereeId: newUserId,
          status: 'registered',
          createdAt: Date.now(),
        })
      }

      await awardServerXp(ctx, newUserId, 'account_created', 'clerk_oauth_signup')
      user = await ctx.db.get(newUserId)
    } else {
      if (!user.clerkUserId) {
        await ctx.db.patch(user._id, {
          clerkUserId: args.clerkUserId,
          avatarUrl: args.avatarUrl || user.avatarUrl,
        })
      }
    }

    const token = await generateSecureToken()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 jours
    await ctx.db.insert('sessions', {
      userId: user!._id,
      token,
      expiresAt,
    })

    const xpSummary = await computeUserXpSummary(ctx, user!._id)

    return {
      token,
      user: {
        id: user!._id,
        name: user!.name,
        email: user!.email,
        phone: user!.phone,
        geoCoordinates: user!.geoCoordinates,
        role: user!.role,
        referralCode: user!.referralCode,
        avatarUrl: user!.avatarUrl,
        totalXp: xpSummary.totalXp,
        level: xpSummary.level,
        xpByDomain: xpSummary.xpByDomain,
        unlockedRewards: xpSummary.unlockedRewards,
      },
    }
  },
})

/**
 * Récupère le profil complet de l'utilisateur connecté avec son niveau (1-100), son XP et ses filleuls
 */
export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null
    try {
      const user = await requireUser(ctx, args.sessionToken)
      const xpSummary = await computeUserXpSummary(ctx, user._id)
      const referrals = await ctx.db
        .query('referrals')
        .withIndex('by_referrer', (q: any) => q.eq('referrerId', user._id))
        .collect()

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        geoCoordinates: user.geoCoordinates,
        role: user.role,
        referralCode: user.referralCode,
        referralsCount: referrals.length,
        rewardedReferralsCount: referrals.filter(
          (r: any) => r.status === 'rewarded'
        ).length,
        ...xpSummary,
      }
    } catch {
      return null
    }
  },
})

/**
 * Mise à jour protégée du profil (téléphone et coordonnées géographiques au Burkina Faso / sous-région)
 */
export const updateProfile = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    phone: v.string(),
    city: v.string(),
    district: v.string(),
    landmark: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)

    const updatedGeo = {
      city: sanitizeServerText(args.city, 60),
      district: sanitizeServerText(args.district, 80),
      landmark: sanitizeServerText(args.landmark, 140),
      lat: args.lat,
      lng: args.lng,
    }

    await ctx.db.patch(user._id, {
      name: sanitizeServerText(args.name, 60),
      phone: sanitizeServerText(args.phone, 25),
      geoCoordinates: updatedGeo,
    })

    return { success: true }
  },
})

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q: any) => q.eq('token', args.sessionToken))
      .first()
    if (session) {
      await ctx.db.delete(session._id)
    }
    return { success: true }
  },
})
