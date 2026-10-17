import {
  DAILY_COMMENT_XP_CAP,
  DAILY_SHARE_CLICK_XP_CAP,
  DOMAIN_REWARDS,
  XP_ACTION_BAREME,
  computeLevelFromXp,
  type XpActionType,
  type XpDomain,
} from './xpConfig'

export function getTodayKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/**
 * Nettoie une chaîne de texte côté serveur contre les injections XSS / balises HTML
 */
export function sanitizeServerText(raw: string, maxLength = 500): string {
  return raw
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, maxLength)
}

/**
 * Vérifie l'identité de l'utilisateur à partir de son jeton de session Convex
 */
export async function requireUser(ctx: any, sessionToken?: string) {
  if (!sessionToken) {
    throw new Error('Connexion requise pour effectuer cette action.')
  }

  const session = await ctx.db
    .query('sessions')
    .withIndex('by_token', (q: any) => q.eq('token', sessionToken))
    .first()

  if (!session || session.expiresAt < Date.now()) {
    throw new Error('Votre session a expiré. Veuillez vous reconnecter.')
  }

  const user = await ctx.db.get(session.userId)
  if (!user) {
    throw new Error('Compte utilisateur introuvable.')
  }

  return user
}

/**
 * Vérifie que l'utilisateur est authentifié ET possède le rôle "admin"
 */
export async function requireAdmin(ctx: any, sessionToken?: string) {
  const user = await requireUser(ctx, sessionToken)
  if (user.role !== 'admin') {
    throw new Error(
      'Accès refusé : cette action est réservée aux administrateurs Maamfoogou.'
    )
  }
  return user
}

/**
 * Attribue de l'XP côté serveur avec vérification des plafonds quotidiens
 */
export async function awardServerXp(
  ctx: any,
  userId: any,
  action: XpActionType,
  reference?: string
): Promise<{ awarded: boolean; points: number }> {
  const rule = XP_ACTION_BAREME[action]
  if (!rule) return { awarded: false, points: 0 }

  const now = Date.now()
  const dayKey = getTodayKey(now)

  // Vérification des plafonds quotidiens (commentaires et clics de partage)
  if (action === 'comment_posted' || action === 'share_link_click') {
    const todayEvents = await ctx.db
      .query('xpEvents')
      .withIndex('by_user_and_day', (q: any) =>
        q.eq('userId', userId).eq('dayKey', dayKey)
      )
      .collect()

    const actionPointsToday = todayEvents
      .filter((ev: any) => ev.action === action)
      .reduce((sum: number, ev: any) => sum + ev.points, 0)

    const cap =
      action === 'comment_posted'
        ? DAILY_COMMENT_XP_CAP
        : DAILY_SHARE_CLICK_XP_CAP

    if (actionPointsToday + rule.points > cap) {
      return { awarded: false, points: 0 }
    }
  }

  await ctx.db.insert('xpEvents', {
    userId,
    action,
    domain: rule.domain,
    points: rule.points,
    date: now,
    dayKey,
    reference,
  })

  return { awarded: true, points: rule.points }
}

/**
 * Calcule le bilan complet d'XP, le niveau (1 à 100), la répartition par domaine
 * et les récompenses débloquées à partir de la table xpEvents
 */
export async function computeUserXpSummary(ctx: any, userId: any) {
  const events = await ctx.db
    .query('xpEvents')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .collect()

  const xpByDomain: Record<XpDomain, number> = {
    achats: 0,
    partage: 0,
    creation: 0,
    communaute: 0,
  }

  let totalXp = 0
  for (const ev of events) {
    totalXp += ev.points
    const dom = ev.domain as XpDomain
    if (dom in xpByDomain) {
      xpByDomain[dom] += ev.points
    }
  }

  const levelInfo = computeLevelFromXp(totalXp)

  const unlockedRewards = DOMAIN_REWARDS.map((reward) => ({
    ...reward,
    unlocked: xpByDomain[reward.domain] >= reward.requiredDomainXp,
    currentDomainXp: xpByDomain[reward.domain],
  }))

  return {
    totalXp,
    ...levelInfo,
    xpByDomain,
    unlockedRewards,
    recentEvents: events
      .slice()
      .sort((a: any, b: any) => b.date - a.date)
      .slice(0, 15),
  }
}
