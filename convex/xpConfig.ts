// Configuration centrale du système d'XP, des niveaux (1 à 100) et des récompenses par domaine

export type XpDomain = 'achats' | 'partage' | 'creation' | 'communaute'

export type XpActionType =
  | 'account_created'
  | 'design_saved'
  | 'custom_tshirt_purchased'
  | 'creator_design_purchased_buyer'
  | 'creator_design_purchased_creator'
  | 'photo_review_posted'
  | 'friend_referral_completed'
  | 'share_link_click'
  | 'share_link_purchase'
  | 'comment_posted'
  | 'design_liked_by_other'

// Barème d'XP par action (modifiable sans perdre l'historique grâce à la table xpEvents)
export const XP_ACTION_BAREME: Record<
  XpActionType,
  { points: number; domain: XpDomain; label: string }
> = {
  account_created: {
    points: 50,
    domain: 'communaute',
    label: 'Création du compte Maamfoogou',
  },
  design_saved: {
    points: 40,
    domain: 'creation',
    label: 'Sauvegarde d’un design personnalisé',
  },
  custom_tshirt_purchased: {
    points: 150,
    domain: 'achats',
    label: 'Achat d’un t-shirt personnalisé',
  },
  creator_design_purchased_buyer: {
    points: 120,
    domain: 'achats',
    label: 'Achat d’un modèle de créateur',
  },
  creator_design_purchased_creator: {
    points: 200,
    domain: 'creation',
    label: 'Vente d’un de vos modèles créateur',
  },
  photo_review_posted: {
    points: 100,
    domain: 'communaute',
    label: 'Avis publié avec photo du t-shirt porté',
  },
  friend_referral_completed: {
    points: 250,
    domain: 'partage',
    label: 'Premier achat validé d’un ami parrainé',
  },
  share_link_click: {
    points: 5,
    domain: 'partage',
    label: 'Clic unique sur votre lien de partage (?ref=)',
  },
  share_link_purchase: {
    points: 180,
    domain: 'partage',
    label: 'Achat réalisé via votre lien de partage',
  },
  comment_posted: {
    points: 10,
    domain: 'communaute',
    label: 'Commentaire publié sur un modèle',
  },
  design_liked_by_other: {
    points: 15,
    domain: 'creation',
    label: 'Like reçu sur votre modèle par un autre membre',
  },
}

// Plafonds quotidiens anti-abus
export const DAILY_COMMENT_XP_CAP = 30 // Max 3 commentaires rémunérés en XP par jour
export const DAILY_SHARE_CLICK_XP_CAP = 50 // Max 10 clics uniques rémunérés en XP par jour
export const COMMENT_MAX_LENGTH = 500
export const COMMENT_RATE_LIMIT_PER_MINUTE = 5

/**
 * Génère la table des seuils d'XP pour les niveaux 1 à 100.
 * Niveau 1 = 0 XP. Progression douce au début puis quadratique jusqu'au niveau 100.
 */
export const LEVEL_THRESHOLDS: Array<number> = Array.from(
  { length: 100 },
  (_, index) => {
    const level = index + 1
    if (level === 1) return 0
    return Math.round(60 * (level - 1) + 12 * Math.pow(level - 1, 1.65))
  }
)

export interface DomainRewardDefinition {
  id: string
  domain: XpDomain
  requiredDomainXp: number
  title: string
  description: string
  badgeCode: string
}

// Structure extensible de récompenses par domaine
export const DOMAIN_REWARDS: Array<DomainRewardDefinition> = [
  {
    id: 'reward-achats-1',
    domain: 'achats',
    requiredDomainXp: 150,
    title: 'Livraison Express Ouaga Offerte',
    description: 'Bon de livraison gratuite à Ouagadougou et Bobo-Dioulasso.',
    badgeCode: 'LIV-BF-FREE',
  },
  {
    id: 'reward-achats-2',
    domain: 'achats',
    requiredDomainXp: 450,
    title: 'Remise Fidélité -15% Coton Faso',
    description: 'Réduction immédiate de 15% sur votre prochaine commande.',
    badgeCode: 'FASOVIP15',
  },
  {
    id: 'reward-creation-1',
    domain: 'creation',
    requiredDomainXp: 100,
    title: 'Badge Créateur Certifié Maamfoogou',
    description: 'Vos modèles publiés reçoivent le badge Créateur Officiel.',
    badgeCode: 'CREATEUR-BF',
  },
  {
    id: 'reward-creation-2',
    domain: 'creation',
    requiredDomainXp: 500,
    title: 'Drop Gratuit Édition Limitée',
    description: '1 t-shirt imprimé de votre propre création offert par l’atelier.',
    badgeCode: 'DROP-FREE-01',
  },
  {
    id: 'reward-partage-1',
    domain: 'partage',
    requiredDomainXp: 100,
    title: 'Ambassadeur Sous-Région (-1 500 FCFA)',
    description: 'Bon de 1 500 FCFA valable dès 10 000 FCFA d’achat.',
    badgeCode: 'AMBA-1500',
  },
  {
    id: 'reward-communaute-1',
    domain: 'communaute',
    requiredDomainXp: 80,
    title: 'Voix de l’Atelier',
    description: 'Accès anticipé aux nouvelles couleurs de coton bio du Faso.',
    badgeCode: 'VOIX-FASO',
  },
]

/**
 * Calcule le niveau actuel (1 à 100) et la progression à partir d'un total d'XP
 */
export function computeLevelFromXp(totalXp: number): {
  level: number
  currentLevelMinXp: number
  nextLevelXp: number
  progressPercent: number
} {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
    } else {
      break
    }
  }

  const currentLevelMinXp = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextLevelXp =
    level < 100
      ? LEVEL_THRESHOLDS[level]
      : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]

  const span = Math.max(1, nextLevelXp - currentLevelMinXp)
  const progressPercent =
    level >= 100
      ? 100
      : Math.min(100, Math.round(((totalXp - currentLevelMinXp) / span) * 100))

  return {
    level,
    currentLevelMinXp,
    nextLevelXp,
    progressPercent,
  }
}
