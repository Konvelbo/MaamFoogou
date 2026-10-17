import { useSyncExternalStore } from 'react'
import {
  COMMENT_MAX_LENGTH,
  COMMENT_RATE_LIMIT_PER_MINUTE,
  DAILY_COMMENT_XP_CAP,
  DAILY_SHARE_CLICK_XP_CAP,
  DOMAIN_REWARDS,
  XP_ACTION_BAREME,
  computeLevelFromXp,
  type XpActionType,
  type XpDomain,
} from '../../convex/xpConfig'
import {
  evaluateVariantStock,
  type StockCheckStatus,
} from '../../convex/stock'
import {
  activePaymentProvider,
  type MobileMoneyOperator,
} from '../../convex/paymentProvider'
import { generateTShirtSvgUrl } from '../utils/tshirtPreviewSvg'

// Constante modifiable du nombre maximum de modèles dans "Modèles à découvrir" (Section 4)
export const FEATURED_DESIGNS_LIMIT = 5

export interface NormalizedDesignElement {
  id: string
  side: 'front' | 'back'
  type: 'text' | 'image'
  // Coordonnées normalisées de 0 à 1 sur la zone d'impression (Section 7)
  x: number
  y: number
  width: number
  height: number
  rotation: number
  text?: string
  font?: string
  fontSize?: number
  color?: string
  fileId?: string
  imageUrl?: string
  mimeType?: string
  originalWidth?: number
  originalHeight?: number
}

export interface MaamfoogouDesign {
  id: string
  ownerId: string
  creatorName: string
  source: 'team' | 'creator'
  name: string
  description: string
  tshirtColor: string
  size: string
  status: 'draft' | 'published'
  price: number // En FCFA
  featured: boolean
  likesCount: number
  commentsCount: number
  previewFrontUrl: string
  previewBackUrl: string
  printFrontUrl?: string
  printBackUrl?: string
  colorVariants: Array<{
    color: string
    label: string
    previewUrl: string
  }>
  elements: Array<NormalizedDesignElement>
  createdAt: number
}

export interface MaamfoogouUser {
  id: string
  name: string
  email: string
  passwordHash: string
  phone: string
  geoCoordinates: {
    city: string
    district: string
    landmark: string
    lat?: number
    lng?: number
  }
  role: 'admin' | 'user'
  referralCode: string
  referredByUserId?: string
  createdAt: number
}

export interface MaamfoogouComment {
  id: string
  designId: string
  userId: string
  authorName: string
  authorLevel: number
  authorRole: 'admin' | 'user'
  text: string
  parentId?: string
  photoUrl?: string
  status: 'visible' | 'hidden' | 'reported'
  createdAt: number
  editedAt?: number
}

export interface StockVariantRow {
  id: string
  color: string
  colorName: string
  size: string
  quantity: number
  reserved: number
  lowThreshold: number
  restockDate?: string
}

export interface MaamfoogouOrder {
  id: string
  userId: string
  designId: string
  designName: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  totalAmount: number
  status: 'pending' | 'paid' | 'failed' | 'expired'
  paymentProvider: MobileMoneyOperator
  paymentReference: string
  ussdPromptCode: string
  phoneNumber: string
  deliveryInfo: {
    fullName: string
    phone: string
    city: string
    district: string
    landmark: string
  }
  referralCodeUsed?: string
  createdAt: number
  paidAt?: number
}

export interface XpEventRecord {
  id: string
  userId: string
  action: XpActionType
  domain: XpDomain
  points: number
  date: number
  dayKey: string
  reference?: string
}

export interface ShareLinkRecord {
  code: string
  userId: string
  designId: string
  clicksCount: number
  purchasesCount: number
  createdAt: number
}

export interface ReferralRecord {
  id: string
  referrerId: string
  refereeId: string
  refereeName: string
  status: 'registered' | 'rewarded'
  createdAt: number
  rewardedAt?: number
}

export type PendingProtectedAction =
  | { type: 'like'; designId: string }
  | { type: 'open_route'; route: string; designId?: string }
  | { type: 'save_design' }
  | { type: 'buy_now'; designId: string }

interface StoreDatabaseState {
  currentUserId: string | null
  authModalOpen: boolean
  pendingAction: PendingProtectedAction | null
  lastToast: { id: number; text: string; tone: 'success' | 'info' | 'error' } | null
  users: Array<MaamfoogouUser>
  designs: Array<MaamfoogouDesign>
  likes: Array<{ userId: string; designId: string; createdAt: number }>
  comments: Array<MaamfoogouComment>
  stock: Array<StockVariantRow>
  orders: Array<MaamfoogouOrder>
  xpEvents: Array<XpEventRecord>
  shareLinks: Array<ShareLinkRecord>
  trackingClicks: Array<{
    code: string
    referrerId: string
    designId?: string
    deviceFingerprint: string
    dayKey: string
  }>
  referrals: Array<ReferralRecord>
}

const STORAGE_KEY = 'maamfoogou_convex_state_v1'
const REF_STORAGE_KEY = 'maamfoogou_ref_tracking_v1'
const DEVICE_FP_KEY = 'maamfoogou_device_fp_v1'

function getTodayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function sanitizeText(raw: string, maxLen = 500): string {
  return raw
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLen)
}

/**
 * Conservation du code de parrainage / tracking (?ref=CODE) en cookie + localStorage pendant 30 jours
 */
export function saveReferralCodeToBrowser(code: string) {
  if (typeof window === 'undefined') return
  const clean = code.trim().toUpperCase()
  if (!clean) return
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000
  localStorage.setItem(
    REF_STORAGE_KEY,
    JSON.stringify({ code: clean, expiresAt })
  )
  document.cookie = `maamfoogou_ref=${encodeURIComponent(clean)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
}

export function getStoredReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { code: string; expiresAt: number }
      if (parsed.expiresAt > Date.now()) {
        return parsed.code
      }
      localStorage.removeItem(REF_STORAGE_KEY)
    }
    const cookieMatch = document.cookie.match(/(?:^|;\s*)maamfoogou_ref=([^;]*)/)
    if (cookieMatch?.[1]) {
      return decodeURIComponent(cookieMatch[1])
    }
  } catch {
    return undefined
  }
  return undefined
}

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server-fp'
  let fp = localStorage.getItem(DEVICE_FP_KEY)
  if (!fp) {
    fp = `fp_${Math.random().toString(36).slice(2, 11)}_${navigator.userAgent.length}`
    localStorage.setItem(DEVICE_FP_KEY, fp)
  }
  return fp
}

// Données initiales réalistes pour le Burkina Faso et la sous-région
function buildInitialState(): StoreDatabaseState {
  const now = Date.now()
  const dayKey = getTodayKey(now)

  const initialUsers: Array<MaamfoogouUser> = [
    {
      id: 'usr-admin-1',
      name: 'Atelier Maamfoogou (Admin)',
      email: 'admin@maamfoogou.bf',
      passwordHash: 'Admin2026!',
      phone: '+226 70 11 22 33',
      geoCoordinates: {
        city: 'Ouagadougou',
        district: 'Koulouba, Avenue Kwame Nkrumah',
        landmark: 'À 100m du siège Orange Burkina',
        lat: 12.3686,
        lng: -1.5275,
      },
      role: 'admin',
      referralCode: 'MFO-ADMIN',
      createdAt: now - 86400000 * 30,
    },
    {
      id: 'usr-creator-1',
      name: 'Kader Ouédraogo',
      email: 'kader@maamfoogou.bf',
      passwordHash: 'Kader2026!',
      phone: '+226 76 44 55 66',
      geoCoordinates: {
        city: 'Ouagadougou',
        district: 'Ouaga 2000',
        landmark: 'Près du Monument des Héros Nationaux',
        lat: 12.3124,
        lng: -1.5091,
      },
      role: 'user',
      referralCode: 'KAD-2260',
      createdAt: now - 86400000 * 18,
    },
    {
      id: 'usr-creator-2',
      name: 'Aminata Sawadogo',
      email: 'aminata@maamfoogou.bf',
      passwordHash: 'Aminata2026!',
      phone: '+226 65 88 99 00',
      geoCoordinates: {
        city: 'Bobo-Dioulasso',
        district: 'Secteur 1, Dioulassobâ',
        landmark: 'Face à la Grande Mosquée de Bobo',
        lat: 11.1771,
        lng: -4.2979,
      },
      role: 'user',
      referralCode: 'AMI-BBD1',
      createdAt: now - 86400000 * 14,
    },
  ]

  const initialDesigns: Array<MaamfoogouDesign> = [
    {
      id: 'des-etalon-or',
      ownerId: 'usr-admin-1',
      creatorName: 'Équipe Maamfoogou',
      source: 'team',
      name: 'Étalon d’Or — Coton Bio du Faso',
      description:
        'Coton peigné 240g/m² cultivé et tissé au Burkina Faso. Sérigraphie poitrine dorée et blason minimaliste au dos.',
      tshirtColor: '#18181B',
      size: 'L',
      status: 'published',
      price: 12500,
      featured: true,
      likesCount: 42,
      commentsCount: 2,
      previewFrontUrl: generateTShirtSvgUrl({
        tshirtColor: '#18181B',
        view: 'front',
        headline: 'ÉTALON D’OR',
        subline: 'BURKINA FASO • 226',
        accentColor: '#D97706',
      }),
      previewBackUrl: generateTShirtSvgUrl({
        tshirtColor: '#18181B',
        view: 'back',
        headline: 'LA PATRIE OU LA MORT',
        subline: 'ÉDITION OUAGA 01',
        accentColor: '#D97706',
      }),
      colorVariants: [
        {
          color: '#2D4A3E',
          label: 'Vert Karité',
          previewUrl: generateTShirtSvgUrl({
            tshirtColor: '#2D4A3E',
            view: 'front',
            headline: 'ÉTALON D’OR',
            subline: 'BURKINA FASO • 226',
            accentColor: '#D6C7B2',
          }),
        },
        {
          color: '#F4F4F0',
          label: 'Blanc Craie',
          previewUrl: generateTShirtSvgUrl({
            tshirtColor: '#F4F4F0',
            view: 'front',
            headline: 'ÉTALON D’OR',
            subline: 'BURKINA FASO • 226',
            accentColor: '#C2410C',
          }),
        },
      ],
      elements: [
        {
          id: 'el-1',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.38,
          width: 0.45,
          height: 0.18,
          rotation: 0,
          text: 'ÉTALON D’OR',
          font: 'Impact, Haettenschweiler, sans-serif',
          fontSize: 60,
          color: '#D97706',
        },
        {
          id: 'el-2',
          side: 'back',
          type: 'text',
          x: 0.5,
          y: 0.34,
          width: 0.44,
          height: 0.16,
          rotation: 0,
          text: 'BURKINA 226',
          font: '"Courier New", Courier, monospace',
          fontSize: 48,
          color: '#F4F4F0',
        },
      ],
      createdAt: now - 86400000 * 10,
    },
    {
      id: 'des-faso-danfani',
      ownerId: 'usr-creator-2',
      creatorName: 'Aminata Sawadogo',
      source: 'creator',
      name: 'Faso Dan Fani Géométrique',
      description:
        'Inspiré des bandes tissées traditionnelles du Faso Dan Fani revisitées en streetwear moderne.',
      tshirtColor: '#9A3412',
      size: 'M',
      status: 'published',
      price: 11000,
      featured: true,
      likesCount: 37,
      commentsCount: 1,
      previewFrontUrl: generateTShirtSvgUrl({
        tshirtColor: '#9A3412',
        view: 'front',
        headline: 'DAN FANI',
        subline: 'TISSAGE DU FASO',
        accentColor: '#F4F4F0',
      }),
      previewBackUrl: generateTShirtSvgUrl({
        tshirtColor: '#9A3412',
        view: 'back',
        headline: 'BOBO-DIOULASSO',
        subline: 'CRÉATION AMINATA S.',
        accentColor: '#FDE047',
      }),
      colorVariants: [
        {
          color: '#D6C7B2',
          label: 'Sable Désert',
          previewUrl: generateTShirtSvgUrl({
            tshirtColor: '#D6C7B2',
            view: 'front',
            headline: 'DAN FANI',
            subline: 'TISSAGE DU FASO',
            accentColor: '#9A3412',
          }),
        },
      ],
      elements: [
        {
          id: 'el-df-1',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.4,
          width: 0.42,
          height: 0.17,
          rotation: 0,
          text: 'DAN FANI STUDIO',
          font: 'Georgia, Cambria, serif',
          fontSize: 56,
          color: '#F4F4F0',
        },
      ],
      createdAt: now - 86400000 * 8,
    },
    {
      id: 'des-ouaga-vibes',
      ownerId: 'usr-creator-1',
      creatorName: 'Kader Ouédraogo',
      source: 'creator',
      name: 'Ouaga Street Vibes 226',
      description:
        'Typographie urbaine rendant hommage à l’énergie créative des quartiers de Ouagadougou.',
      tshirtColor: '#F4F4F0',
      size: 'L',
      status: 'published',
      price: 10500,
      featured: true,
      likesCount: 29,
      commentsCount: 0,
      previewFrontUrl: generateTShirtSvgUrl({
        tshirtColor: '#F4F4F0',
        view: 'front',
        headline: 'OUAGA VIBES',
        subline: 'STREET CULTURE +226',
        accentColor: '#C2410C',
      }),
      previewBackUrl: generateTShirtSvgUrl({
        tshirtColor: '#F4F4F0',
        view: 'back',
        headline: 'FASO YOUTH',
        subline: 'KADER OUÉDRAOGO',
        accentColor: '#18181B',
      }),
      colorVariants: [
        {
          color: '#18181B',
          label: 'Noir Carbone',
          previewUrl: generateTShirtSvgUrl({
            tshirtColor: '#18181B',
            view: 'front',
            headline: 'OUAGA VIBES',
            subline: 'STREET CULTURE +226',
            accentColor: '#D97706',
          }),
        },
      ],
      elements: [
        {
          id: 'el-ov-1',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.39,
          width: 0.45,
          height: 0.18,
          rotation: 0,
          text: 'OUAGA VIBES',
          font: 'Impact, Haettenschweiler, sans-serif',
          fontSize: 62,
          color: '#18181B',
        },
      ],
      createdAt: now - 86400000 * 6,
    },
    {
      id: 'des-sahel-solaire',
      ownerId: 'usr-admin-1',
      creatorName: 'Équipe Maamfoogou',
      source: 'team',
      name: 'Horizon Sahel & Karité',
      description:
        'Coupe ample respirante adaptée au climat sahélien, teinture minérale durable.',
      tshirtColor: '#2D4A3E',
      size: 'XL',
      status: 'published',
      price: 11500,
      featured: true,
      likesCount: 24,
      commentsCount: 0,
      previewFrontUrl: generateTShirtSvgUrl({
        tshirtColor: '#2D4A3E',
        view: 'front',
        headline: 'SAHEL SOLAR',
        subline: 'COTON LOURD 240G',
        accentColor: '#D6C7B2',
      }),
      previewBackUrl: generateTShirtSvgUrl({
        tshirtColor: '#2D4A3E',
        view: 'back',
        headline: 'TERRE INTÈGRE',
        subline: 'COLLECTION OFFICIELLE',
        accentColor: '#D97706',
      }),
      colorVariants: [
        {
          color: '#D6C7B2',
          label: 'Sable Désert',
          previewUrl: generateTShirtSvgUrl({
            tshirtColor: '#D6C7B2',
            view: 'front',
            headline: 'SAHEL SOLAR',
            subline: 'COTON LOURD 240G',
            accentColor: '#2D4A3E',
          }),
        },
      ],
      elements: [
        {
          id: 'el-ss-1',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.4,
          width: 0.44,
          height: 0.17,
          rotation: 0,
          text: 'SAHEL SOLAR',
          font: 'Georgia, Cambria, serif',
          fontSize: 58,
          color: '#D6C7B2',
        },
      ],
      createdAt: now - 86400000 * 4,
    },
    {
      id: 'des-siao-fespaco',
      ownerId: 'usr-creator-1',
      creatorName: 'Kader Ouédraogo',
      source: 'creator',
      name: 'Cinéma d’Afrique — Édition Fespaco',
      description:
        'Hommage graphique au 7e art africain et aux créateurs de la sous-région ouest-africaine.',
      tshirtColor: '#1E293B',
      size: 'M',
      status: 'published',
      price: 13000,
      featured: true,
      likesCount: 19,
      commentsCount: 0,
      previewFrontUrl: generateTShirtSvgUrl({
        tshirtColor: '#1E293B',
        view: 'front',
        headline: 'CINÉMA FASO',
        subline: 'SOUS-RÉGION • ART',
        accentColor: '#CA8A04',
      }),
      previewBackUrl: generateTShirtSvgUrl({
        tshirtColor: '#1E293B',
        view: 'back',
        headline: 'YENNENGA 2026',
        subline: 'ÉDITION COLLECTOR',
        accentColor: '#F4F4F0',
      }),
      colorVariants: [
        {
          color: '#4C1D24',
          label: 'Bordeaux',
          previewUrl: generateTShirtSvgUrl({
            tshirtColor: '#4C1D24',
            view: 'front',
            headline: 'CINÉMA FASO',
            subline: 'SOUS-RÉGION • ART',
            accentColor: '#CA8A04',
          }),
        },
      ],
      elements: [
        {
          id: 'el-cf-1',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.39,
          width: 0.45,
          height: 0.18,
          rotation: 0,
          text: 'CINÉMA FASO',
          font: 'Impact, Haettenschweiler, sans-serif',
          fontSize: 60,
          color: '#CA8A04',
        },
      ],
      createdAt: now - 86400000 * 2,
    },
    {
      id: 'des-koko-donda',
      ownerId: 'usr-creator-2',
      creatorName: 'Aminata Sawadogo',
      source: 'creator',
      name: 'Koko Donda Indigo',
      description:
        'Motif teint artisanalement inspiré du pagne Koko Donda de Bobo-Dioulasso.',
      tshirtColor: '#1D4ED8',
      size: 'L',
      status: 'published',
      price: 11500,
      featured: false,
      likesCount: 14,
      commentsCount: 0,
      previewFrontUrl: generateTShirtSvgUrl({
        tshirtColor: '#1D4ED8',
        view: 'front',
        headline: 'KOKO DONDA',
        subline: 'INDIGO ARTISANAL',
        accentColor: '#FDE047',
      }),
      previewBackUrl: generateTShirtSvgUrl({
        tshirtColor: '#1D4ED8',
        view: 'back',
        headline: 'ART DU FASO',
        subline: 'BOBO • OUAGA • BAMAKO',
        accentColor: '#FFFFFF',
      }),
      colorVariants: [],
      elements: [
        {
          id: 'el-kd-1',
          side: 'front',
          type: 'text',
          x: 0.5,
          y: 0.4,
          width: 0.45,
          height: 0.18,
          rotation: 0,
          text: 'KOKO DONDA',
          font: 'Impact, Haettenschweiler, sans-serif',
          fontSize: 60,
          color: '#FDE047',
        },
      ],
      createdAt: now - 86400000 * 1,
    },
  ]

  // Table de stock illustrant tous les cas de la Section 8 (available, low, partial, out_of_stock + restockDate)
  const colors = [
    { hex: '#18181B', name: 'Noir Carbone' },
    { hex: '#F4F4F0', name: 'Blanc Craie' },
    { hex: '#9A3412', name: 'Terracotta' },
    { hex: '#2D4A3E', name: 'Vert Sauge' },
    { hex: '#1E293B', name: 'Bleu Nuit' },
    { hex: '#D6C7B2', name: 'Sable Désert' },
    { hex: '#4C1D24', name: 'Bordeaux' },
    { hex: '#CA8A04', name: 'Ocre Solaire' },
    { hex: '#1D4ED8', name: 'Bleu Cobalt' },
  ]
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const initialStock: Array<StockVariantRow> = []

  colors.forEach((c) => {
    sizes.forEach((s) => {
      let quantity = 40
      let restockDate: string | undefined = undefined

      // Variantes en stock faible (low : <= 5) pour démonstration immédiate
      if (s === 'M' && (c.hex === '#18181B' || c.hex === '#9A3412')) {
        quantity = 3
      } else if (s === 'XL' && c.hex === '#2D4A3E') {
        quantity = 4
      }
      // Variantes en rupture de stock (out_of_stock : 0) avec date de réapprovisionnement
      else if (s === 'XS' && c.hex === '#9A3412') {
        quantity = 0
        restockDate = '28/10/2026'
      } else if (s === 'XXL' && c.hex === '#18181B') {
        quantity = 0
        restockDate = '02/11/2026'
      }

      initialStock.push({
        id: `stk_${c.hex}_${s}`,
        color: c.hex,
        colorName: c.name,
        size: s,
        quantity,
        reserved: 0,
        lowThreshold: 5,
        restockDate,
      })
    })
  })

  const initialComments: Array<MaamfoogouComment> = [
    {
      id: 'cmt-1',
      designId: 'des-etalon-or',
      userId: 'usr-creator-1',
      authorName: 'Kader Ouédraogo',
      authorLevel: 4,
      authorRole: 'user',
      text: 'La qualité du coton 240g est incroyable sous la chaleur de Ouaga ! Le doré ressort super bien.',
      status: 'visible',
      createdAt: now - 3600000 * 12,
    },
    {
      id: 'cmt-2',
      designId: 'des-etalon-or',
      userId: 'usr-admin-1',
      authorName: 'Atelier Maamfoogou (Admin)',
      authorLevel: 12,
      authorRole: 'admin',
      text: 'Merci Kader ! Toutes nos encres sont certifiées grand teint et résistent au lavage intensif.',
      parentId: 'cmt-1',
      status: 'visible',
      createdAt: now - 3600000 * 8,
    },
    {
      id: 'cmt-3',
      designId: 'des-faso-danfani',
      userId: 'usr-creator-1',
      authorName: 'Kader Ouédraogo',
      authorLevel: 4,
      authorRole: 'user',
      text: 'Superbe hommage au Faso Dan Fani Aminata, la teinte Terracotta est parfaite.',
      status: 'visible',
      createdAt: now - 3600000 * 5,
    },
  ]

  const initialXpEvents: Array<XpEventRecord> = [
    {
      id: 'xp-init-1',
      userId: 'usr-admin-1',
      action: 'account_created',
      domain: 'communaute',
      points: 50,
      date: now - 86400000 * 20,
      dayKey,
    },
    {
      id: 'xp-init-2',
      userId: 'usr-admin-1',
      action: 'creator_design_purchased_creator',
      domain: 'creation',
      points: 600,
      date: now - 86400000 * 5,
      dayKey,
    },
    {
      id: 'xp-init-3',
      userId: 'usr-creator-1',
      action: 'account_created',
      domain: 'communaute',
      points: 50,
      date: now - 86400000 * 15,
      dayKey,
    },
    {
      id: 'xp-init-4',
      userId: 'usr-creator-1',
      action: 'design_saved',
      domain: 'creation',
      points: 180,
      date: now - 86400000 * 7,
      dayKey,
    },
  ]

  return {
    currentUserId: null,
    authModalOpen: false,
    pendingAction: null,
    lastToast: null,
    users: initialUsers,
    designs: initialDesigns,
    likes: [],
    comments: initialComments,
    stock: initialStock,
    orders: [],
    xpEvents: initialXpEvents,
    shareLinks: [],
    trackingClicks: [],
    referrals: [],
  }
}

let storeState: StoreDatabaseState = buildInitialState()
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<StoreDatabaseState>
      if (parsed.designs && parsed.stock && parsed.users) {
        storeState = {
          ...storeState,
          ...parsed,
          authModalOpen: false,
          lastToast: null,
        }
      }
    }
  } catch {
    // Conserver l'état initial
  }
}

function emitChange() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storeState))
    } catch {
      // Ignorer dépassement quota éventuel
    }
  }
  listeners.forEach((l) => l())
}

export function showToast(
  text: string,
  tone: 'success' | 'info' | 'error' = 'success'
) {
  storeState = {
    ...storeState,
    lastToast: { id: Date.now(), text, tone },
  }
  emitChange()
}

export function clearToast() {
  storeState = { ...storeState, lastToast: null }
  emitChange()
}

export function useMaamfoogouStore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => storeState,
    () => storeState
  )
}

/**
 * Calcul côté serveur du niveau (1 à 100), de l'XP par domaine et des récompenses d'un utilisateur
 */
export function getUserXpSummary(userId: string) {
  const userEvents = storeState.xpEvents.filter((e) => e.userId === userId)
  const xpByDomain: Record<XpDomain, number> = {
    achats: 0,
    partage: 0,
    creation: 0,
    communaute: 0,
  }

  let totalXp = 0
  for (const ev of userEvents) {
    totalXp += ev.points
    xpByDomain[ev.domain] = (xpByDomain[ev.domain] || 0) + ev.points
  }

  const levelInfo = computeLevelFromXp(totalXp)
  const unlockedRewards = DOMAIN_REWARDS.map((r) => ({
    ...r,
    unlocked: xpByDomain[r.domain] >= r.requiredDomainXp,
    currentDomainXp: xpByDomain[r.domain],
  }))

  return {
    totalXp,
    ...levelInfo,
    xpByDomain,
    unlockedRewards,
    recentEvents: userEvents.slice().sort((a, b) => b.date - a.date),
  }
}

function grantXpInternal(
  userId: string,
  action: XpActionType,
  reference?: string
): number {
  const rule = XP_ACTION_BAREME[action]
  if (!rule) return 0

  const dayKey = getTodayKey()
  if (action === 'comment_posted' || action === 'share_link_click') {
    const todayPoints = storeState.xpEvents
      .filter(
        (e) =>
          e.userId === userId && e.dayKey === dayKey && e.action === action
      )
      .reduce((s, e) => s + e.points, 0)

    const cap =
      action === 'comment_posted'
        ? DAILY_COMMENT_XP_CAP
        : DAILY_SHARE_CLICK_XP_CAP
    if (todayPoints + rule.points > cap) return 0
  }

  const newEvent: XpEventRecord = {
    id: `xp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    action,
    domain: rule.domain,
    points: rule.points,
    date: Date.now(),
    dayKey,
    reference,
  }

  storeState = {
    ...storeState,
    xpEvents: [newEvent, ...storeState.xpEvents],
  }
  return rule.points
}

/**
 * Ouvre la modale de connexion/inscription et mémorise l'action protégée à exécuter automatiquement après connexion
 */
export function openAuthForProtectedAction(
  pendingAction: PendingProtectedAction | null = null
) {
  storeState = {
    ...storeState,
    authModalOpen: true,
    pendingAction,
  }
  emitChange()
}

export function closeAuthModal() {
  storeState = {
    ...storeState,
    authModalOpen: false,
    pendingAction: null,
  }
  emitChange()
}

/**
 * Authentification (Connexion ou Création de compte) avec reprise automatique de l'action initiale
 */
export function authenticateUser(params: {
  mode: 'login' | 'register'
  email: string
  password: string
  name?: string
  phone?: string
  city?: string
  district?: string
}): {
  success: boolean
  error?: string
  resumedAction?: PendingProtectedAction | null
} {
  const cleanEmail = params.email.trim().toLowerCase()
  const existing = storeState.users.find(
    (u) => u.email.toLowerCase() === cleanEmail
  )

  let activeUser: MaamfoogouUser

  if (params.mode === 'login') {
    if (!existing || existing.passwordHash !== params.password) {
      return {
        success: false,
        error:
          'Identifiants incorrects. (Astuce démo : kader@maamfoogou.bf / Kader2026! ou admin@maamfoogou.bf / Admin2026!)',
      }
    }
    activeUser = existing
  } else {
    if (existing) {
      return {
        success: false,
        error: 'Cet email possède déjà un compte. Veuillez vous connecter.',
      }
    }

    const cleanName = sanitizeText(params.name || 'Nouveau Membre', 60)
    const refCode = getStoredReferralCode()
    let referredByUserId: string | undefined

    if (refCode) {
      const refOwner = storeState.users.find(
        (u) => u.referralCode.toUpperCase() === refCode.toUpperCase()
      )
      if (refOwner && refOwner.email.toLowerCase() !== cleanEmail) {
        referredByUserId = refOwner.id
      }
    }

    const newUserId = `usr_${Date.now()}`
    const prefix =
      cleanName
        .replace(/[^a-zA-Z]/g, '')
        .toUpperCase()
        .slice(0, 3) || 'MFO'
    const referralCode = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    activeUser = {
      id: newUserId,
      name: cleanName,
      email: cleanEmail,
      passwordHash: params.password,
      phone: sanitizeText(params.phone || '+226 70 00 00 00', 25),
      geoCoordinates: {
        city: sanitizeText(params.city || 'Ouagadougou', 50),
        district: sanitizeText(params.district || 'Secteur 15 / Patte d’Oie', 60),
        landmark: 'Près du goudron principal',
      },
      role: cleanEmail === 'admin@maamfoogou.bf' ? 'admin' : 'user',
      referralCode,
      referredByUserId,
      createdAt: Date.now(),
    }

    const nextReferrals = [...storeState.referrals]
    if (referredByUserId) {
      nextReferrals.unshift({
        id: `ref_${Date.now()}`,
        referrerId: referredByUserId,
        refereeId: newUserId,
        refereeName: cleanName,
        status: 'registered',
        createdAt: Date.now(),
      })
    }

    storeState = {
      ...storeState,
      users: [...storeState.users, activeUser],
      referrals: nextReferrals,
    }

    grantXpInternal(newUserId, 'account_created', 'welcome')
  }

  const pending = storeState.pendingAction
  storeState = {
    ...storeState,
    currentUserId: activeUser.id,
    authModalOpen: false,
    pendingAction: null,
  }

  // Exécution automatique de l'action initiale après connexion (ex: Like automatique)
  if (pending?.type === 'like') {
    toggleDesignLike(pending.designId)
  } else {
    showToast(`Bienvenue ${activeUser.name} !`, 'success')
    emitChange()
  }

  return { success: true, resumedAction: pending }
}

export function logoutUser() {
  storeState = {
    ...storeState,
    currentUserId: null,
  }
  showToast('Vous êtes déconnecté.', 'info')
  emitChange()
}

export function updateUserProfile(params: {
  name: string
  phone: string
  city: string
  district: string
  landmark: string
}) {
  if (!storeState.currentUserId) {
    openAuthForProtectedAction()
    return
  }

  storeState = {
    ...storeState,
    users: storeState.users.map((u) =>
      u.id === storeState.currentUserId
        ? {
            ...u,
            name: sanitizeText(params.name, 60),
            phone: sanitizeText(params.phone, 25),
            geoCoordinates: {
              ...u.geoCoordinates,
              city: sanitizeText(params.city, 50),
              district: sanitizeText(params.district, 60),
              landmark: sanitizeText(params.landmark, 120),
            },
          }
        : u
    ),
  }
  showToast('Profil et coordonnées géographiques mis à jour !', 'success')
  emitChange()
}

/**
 * Section 5 : Like et sauvegarde automatique dans "Mes collections > Produits sauvegardés"
 */
export function toggleDesignLike(designId: string): {
  requiresAuth: boolean
  liked?: boolean
} {
  if (!storeState.currentUserId) {
    openAuthForProtectedAction({ type: 'like', designId })
    return { requiresAuth: true }
  }

  const userId = storeState.currentUserId
  const design = storeState.designs.find((d) => d.id === designId)
  if (!design) return { requiresAuth: false }

  const existing = storeState.likes.find(
    (l) => l.userId === userId && l.designId === designId
  )

  if (existing) {
    storeState = {
      ...storeState,
      likes: storeState.likes.filter(
        (l) => !(l.userId === userId && l.designId === designId)
      ),
      designs: storeState.designs.map((d) =>
        d.id === designId
          ? { ...d, likesCount: Math.max(0, d.likesCount - 1) }
          : d
      ),
    }
    showToast(
      `Retiré de vos likes et de la collection « À acheter plus tard ».`,
      'info'
    )
    emitChange()
    return { requiresAuth: false, liked: false }
  }

  storeState = {
    ...storeState,
    likes: [
      { userId, designId, createdAt: Date.now() },
      ...storeState.likes,
    ],
    designs: storeState.designs.map((d) =>
      d.id === designId ? { ...d, likesCount: d.likesCount + 1 } : d
    ),
  }

  // XP pour le créateur si un autre utilisateur like son modèle (anti auto-like)
  if (design.ownerId !== userId) {
    const refKey = `like_${userId}_${designId}`
    const alreadyGiven = storeState.xpEvents.some((e) => e.reference === refKey)
    if (!alreadyGiven) {
      grantXpInternal(design.ownerId, 'design_liked_by_other', refKey)
    }
  }

  showToast(
    `Modèle liké et sauvegardé dans « Mes collections > À acheter plus tard » !`,
    'success'
  )
  emitChange()
  return { requiresAuth: false, liked: true }
}

/**
 * Section 6 : Commentaires en temps réel avec protection XSS, anti-spam (5/min), signalement et modération
 */
export function addDesignComment(params: {
  designId: string
  text: string
  parentId?: string
  photoUrl?: string
}): { success: boolean; error?: string } {
  if (!storeState.currentUserId) {
    openAuthForProtectedAction({
      type: 'open_route',
      route: `/p/${params.designId}`,
      designId: params.designId,
    })
    return { success: false, error: 'Connexion requise.' }
  }

  const user = storeState.users.find((u) => u.id === storeState.currentUserId)
  if (!user) return { success: false, error: 'Utilisateur introuvable.' }

  const cleanText = sanitizeText(params.text, COMMENT_MAX_LENGTH)
  if (!cleanText) {
    return { success: false, error: 'Le commentaire ne peut pas être vide.' }
  }

  // Vérification de la limite de fréquence : 5 commentaires max par minute
  const oneMinuteAgo = Date.now() - 60 * 1000
  const recentCount = storeState.comments.filter(
    (c) => c.userId === user.id && c.createdAt > oneMinuteAgo
  ).length

  if (recentCount >= COMMENT_RATE_LIMIT_PER_MINUTE) {
    return {
      success: false,
      error: `Anti-spam : maximum ${COMMENT_RATE_LIMIT_PER_MINUTE} commentaires par minute.`,
    }
  }

  const xpSummary = getUserXpSummary(user.id)
  const newComment: MaamfoogouComment = {
    id: `cmt_${Date.now()}`,
    designId: params.designId,
    userId: user.id,
    authorName: user.name,
    authorLevel: xpSummary.level,
    authorRole: user.role,
    text: cleanText,
    parentId: params.parentId,
    photoUrl: params.photoUrl,
    status: 'visible',
    createdAt: Date.now(),
  }

  storeState = {
    ...storeState,
    comments: [newComment, ...storeState.comments],
    designs: storeState.designs.map((d) =>
      d.id === params.designId
        ? { ...d, commentsCount: d.commentsCount + 1 }
        : d
    ),
  }

  const earnedXp = grantXpInternal(
    user.id,
    params.photoUrl ? 'photo_review_posted' : 'comment_posted',
    newComment.id
  )

  showToast(
    earnedXp > 0
      ? `Commentaire publié ! (+${earnedXp} XP)`
      : 'Commentaire publié ! (Plafond XP quotidien atteint)',
    'success'
  )
  emitChange()
  return { success: true }
}

export function editDesignComment(commentId: string, newText: string) {
  if (!storeState.currentUserId) return
  const comment = storeState.comments.find((c) => c.id === commentId)
  if (!comment || comment.userId !== storeState.currentUserId) {
    showToast('Seul l’auteur peut modifier ce commentaire.', 'error')
    return
  }

  const clean = sanitizeText(newText, COMMENT_MAX_LENGTH)
  if (!clean) return

  storeState = {
    ...storeState,
    comments: storeState.comments.map((c) =>
      c.id === commentId ? { ...c, text: clean, editedAt: Date.now() } : c
    ),
  }
  emitChange()
}

export function deleteDesignComment(commentId: string) {
  if (!storeState.currentUserId) return
  const comment = storeState.comments.find((c) => c.id === commentId)
  if (!comment || comment.userId !== storeState.currentUserId) {
    showToast('Seul l’auteur peut supprimer ce commentaire.', 'error')
    return
  }

  storeState = {
    ...storeState,
    comments: storeState.comments.filter((c) => c.id !== commentId),
    designs: storeState.designs.map((d) =>
      d.id === comment.designId
        ? { ...d, commentsCount: Math.max(0, d.commentsCount - 1) }
        : d
    ),
  }
  showToast('Commentaire supprimé.', 'info')
  emitChange()
}

export function reportDesignComment(commentId: string) {
  if (!storeState.currentUserId) {
    openAuthForProtectedAction()
    return
  }

  storeState = {
    ...storeState,
    comments: storeState.comments.map((c) =>
      c.id === commentId ? { ...c, status: 'reported' } : c
    ),
  }
  showToast('Commentaire signalé aux administrateurs.', 'info')
  emitChange()
}

export function moderateDesignComment(
  commentId: string,
  nextStatus: 'visible' | 'hidden'
) {
  const admin = storeState.users.find((u) => u.id === storeState.currentUserId)
  if (!admin || admin.role !== 'admin') {
    showToast('Action réservée aux administrateurs.', 'error')
    return
  }

  const target = storeState.comments.find((c) => c.id === commentId)
  if (!target) return

  storeState = {
    ...storeState,
    comments: storeState.comments.map((c) =>
      c.id === commentId ? { ...c, status: nextStatus } : c
    ),
    designs:
      nextStatus === 'hidden' && target.status !== 'hidden'
        ? storeState.designs.map((d) =>
            d.id === target.designId
              ? { ...d, commentsCount: Math.max(0, d.commentsCount - 1) }
              : d
          )
        : storeState.designs,
  }
  showToast(
    nextStatus === 'hidden'
      ? 'Commentaire masqué par la modération.'
      : 'Commentaire approuvé et maintenu visible.',
    'success'
  )
  emitChange()
}

/**
 * Section 7 : Sauvegarde d'un design personnalisé (positions normalisées 0..1 + aperçus Face/Dos + exports d'impression)
 */
export function saveNormalizedDesign(params: {
  designId?: string
  name: string
  description: string
  tshirtColor: string
  size: string
  status: 'draft' | 'published'
  price: number
  previewFrontUrl: string
  previewBackUrl: string
  printFrontUrl?: string
  printBackUrl?: string
  elements: Array<NormalizedDesignElement>
}): { success: boolean; designId?: string } {
  if (!storeState.currentUserId) {
    openAuthForProtectedAction({ type: 'save_design' })
    return { success: false }
  }

  const user = storeState.users.find((u) => u.id === storeState.currentUserId)
  if (!user) return { success: false }

  const normalizedElements = params.elements.map((el) => ({
    ...el,
    x: Math.max(0, Math.min(1, Number(el.x.toFixed(4)))),
    y: Math.max(0, Math.min(1, Number(el.y.toFixed(4)))),
    width: Math.max(0.02, Math.min(1, Number(el.width.toFixed(4)))),
    height: Math.max(0.02, Math.min(1, Number(el.height.toFixed(4)))),
  }))

  const id = params.designId || `des_custom_${Date.now()}`
  const newDesign: MaamfoogouDesign = {
    id,
    ownerId: user.id,
    creatorName: user.name,
    source: user.role === 'admin' ? 'team' : 'creator',
    name: sanitizeText(params.name || 'Création Maamfoogou', 70),
    description: sanitizeText(
      params.description || 'Création personnalisée 3D Maamfoogou.',
      240
    ),
    tshirtColor: params.tshirtColor,
    size: params.size,
    status: params.status,
    price: params.price || 12000,
    featured: false,
    likesCount: 0,
    commentsCount: 0,
    previewFrontUrl: params.previewFrontUrl,
    previewBackUrl: params.previewBackUrl,
    printFrontUrl: params.printFrontUrl,
    printBackUrl: params.printBackUrl,
    colorVariants: [],
    elements: normalizedElements,
    createdAt: Date.now(),
  }

  const exists = storeState.designs.some((d) => d.id === id)
  storeState = {
    ...storeState,
    designs: exists
      ? storeState.designs.map((d) => (d.id === id ? newDesign : d))
      : [newDesign, ...storeState.designs],
  }

  const xp = grantXpInternal(user.id, 'design_saved', id)
  showToast(
    `Design « ${newDesign.name} » sauvegardé dans Mes collections ! (+${xp} XP)`,
    'success'
  )
  emitChange()
  return { success: true, designId: id }
}

/**
 * Section 8 : Vérification temps réel du stock (côté serveur)
 */
export function checkVariantStockServer(
  color: string,
  size: string,
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
  const row =
    storeState.stock.find(
      (s) =>
        s.color.toLowerCase() === color.toLowerCase() &&
        s.size.toUpperCase() === size.toUpperCase()
    ) || null

  return evaluateVariantStock(row, Math.max(1, requestedQuantity))
}

/**
 * Section 8 & 11 : Création d'une commande avec réservation atomique (reserved += n) et état "pending"
 */
export function createMobileMoneyOrder(params: {
  designId: string
  color: string
  size: string
  quantity: number
  operator: MobileMoneyOperator
  phoneNumber: string
  fullName: string
  city: string
  district: string
  landmark: string
}): {
  success: boolean
  error?: string
  order?: MaamfoogouOrder
} {
  if (!storeState.currentUserId) {
    openAuthForProtectedAction({ type: 'buy_now', designId: params.designId })
    return { success: false, error: 'Connexion requise pour commander.' }
  }

  const user = storeState.users.find((u) => u.id === storeState.currentUserId)
  const design = storeState.designs.find((d) => d.id === params.designId)
  if (!user || !design) {
    return { success: false, error: 'Modèle ou compte introuvable.' }
  }

  const qty = Math.max(1, Math.floor(params.quantity))
  const stockCheck = checkVariantStockServer(params.color, params.size, qty)

  if (
    stockCheck.status === 'unavailable' ||
    stockCheck.status === 'out_of_stock'
  ) {
    return {
      success: false,
      error: stockCheck.message || 'Variante indisponible.',
    }
  }

  if (stockCheck.status === 'partial') {
    return {
      success: false,
      error: `Stock insuffisant : ${stockCheck.message}. Ajustez la quantité à ${stockCheck.available}.`,
    }
  }

  // Réservation atomique : reserved += qty
  storeState = {
    ...storeState,
    stock: storeState.stock.map((s) =>
      s.color.toLowerCase() === params.color.toLowerCase() &&
      s.size.toUpperCase() === params.size.toUpperCase()
        ? { ...s, reserved: s.reserved + qty }
        : s
    ),
  }

  const unitPrice = design.price || 11500
  const totalAmount = unitPrice * qty

  const paymentInit = activePaymentProvider.createPayment({
    orderId: `ord_${Date.now()}`,
    amountFcfa: totalAmount,
    customerPhone: params.phoneNumber,
    customerName: params.fullName,
    operator: params.operator,
  })

  const storedRef = getStoredReferralCode()
  const newOrder: MaamfoogouOrder = {
    id: `ord_${Date.now()}`,
    userId: user.id,
    designId: design.id,
    designName: design.name,
    color: params.color,
    size: params.size,
    quantity: qty,
    unitPrice,
    totalAmount,
    status: 'pending',
    paymentProvider: params.operator,
    paymentReference: paymentInit.paymentReference,
    ussdPromptCode: paymentInit.ussdPromptCode,
    phoneNumber: sanitizeText(params.phoneNumber, 25),
    deliveryInfo: {
      fullName: sanitizeText(params.fullName, 60),
      phone: sanitizeText(params.phoneNumber, 25),
      city: sanitizeText(params.city, 50),
      district: sanitizeText(params.district, 60),
      landmark: sanitizeText(params.landmark, 120),
    },
    referralCodeUsed: storedRef,
    createdAt: Date.now(),
  }

  storeState = {
    ...storeState,
    orders: [newOrder, ...storeState.orders],
  }

  showToast(
    `Commande #${newOrder.id.slice(-5)} créée (pending) : ${qty} t-shirt(s) réservé(s) pendant 15 min.`,
    'info'
  )
  emitChange()
  return { success: true, order: newOrder }
}

/**
 * Section 8.2, 8.3 & 11 :
 * Traitement du Webhook Mobile Money (vérification de signature + mutation interne confirmPayment idempotente)
 */
export function triggerMobileMoneyWebhook(
  paymentReference: string,
  webhookStatus: 'SUCCESS' | 'FAILED' | 'EXPIRED'
): { ok: boolean; message: string } {
  const order = storeState.orders.find(
    (o) => o.paymentReference === paymentReference
  )
  if (!order) {
    return { ok: false, message: 'Référence de paiement introuvable.' }
  }

  const rawPayload = JSON.stringify({
    paymentReference,
    orderId: order.id,
    status: webhookStatus,
    amountFcfa: order.totalAmount,
    operator: order.paymentProvider,
    transactionTimestamp: Date.now(),
  })

  const secret = 'fasopay_secret_bf_2026'
  const signatureHeader = `sha256=${secret}:${rawPayload.length}`

  // 1. Vérification de la signature du prestataire
  if (
    !activePaymentProvider.verifyWebhookSignature(rawPayload, signatureHeader)
  ) {
    return { ok: false, message: 'Signature webhook invalide.' }
  }

  // 2. Idempotence stricte : ne traiter que si la commande est encore "pending"
  if (order.status !== 'pending') {
    return {
      ok: true,
      message: `Webhook ignoré (idempotence) : la commande est déjà à l'état « ${order.status} ».`,
    }
  }

  if (webhookStatus === 'SUCCESS') {
    // Paiement confirmé : quantity -= n ET reserved -= n, statut -> "paid"
    storeState = {
      ...storeState,
      stock: storeState.stock.map((s) =>
        s.color.toLowerCase() === order.color.toLowerCase() &&
        s.size.toUpperCase() === order.size.toUpperCase()
          ? {
              ...s,
              quantity: Math.max(0, s.quantity - order.quantity),
              reserved: Math.max(0, s.reserved - order.quantity),
            }
          : s
      ),
      orders: storeState.orders.map((o) =>
        o.id === order.id
          ? { ...o, status: 'paid', paidAt: Date.now() }
          : o
      ),
    }

    // Attribution de l'XP après paiement confirmé
    const design = storeState.designs.find((d) => d.id === order.designId)
    const isCreatorModel =
      design && design.source === 'creator' && design.ownerId !== order.userId

    const buyerPoints = grantXpInternal(
      order.userId,
      isCreatorModel
        ? 'creator_design_purchased_buyer'
        : 'custom_tshirt_purchased',
      order.id
    )

    if (isCreatorModel && design) {
      grantXpInternal(
        design.ownerId,
        'creator_design_purchased_creator',
        order.id
      )
    }

    // Si un lien de partage ?ref= a été utilisé (anti auto-parrainage)
    if (order.referralCodeUsed) {
      const cleanRef = order.referralCodeUsed.toUpperCase()
      const shareLink = storeState.shareLinks.find((l) => l.code === cleanRef)
      const refOwner = shareLink
        ? storeState.users.find((u) => u.id === shareLink.userId)
        : storeState.users.find(
            (u) => u.referralCode.toUpperCase() === cleanRef
          )

      if (refOwner && refOwner.id !== order.userId) {
        grantXpInternal(refOwner.id, 'share_link_purchase', order.id)
        if (shareLink) {
          storeState = {
            ...storeState,
            shareLinks: storeState.shareLinks.map((l) =>
              l.code === cleanRef
                ? { ...l, purchasesCount: l.purchasesCount + 1 }
                : l
            ),
          }
        }
      }
    }

    // Si l'acheteur avait été parrainé à l'inscription (1er achat réel -> XP au parrain)
    const pendingReferral = storeState.referrals.find(
      (r) => r.refereeId === order.userId && r.status === 'registered'
    )
    if (pendingReferral) {
      storeState = {
        ...storeState,
        referrals: storeState.referrals.map((r) =>
          r.id === pendingReferral.id
            ? { ...r, status: 'rewarded', rewardedAt: Date.now() }
            : r
        ),
      }
      grantXpInternal(
        pendingReferral.referrerId,
        'friend_referral_completed',
        order.userId
      )
    }

    showToast(
      `Webhook Mobile Money confirmé ! Stock décrémenté (-${order.quantity}) et +${buyerPoints} XP crédités.`,
      'success'
    )
    emitChange()
    return { ok: true, message: 'Paiement confirmé par webhook.' }
  }

  // Paiement échoué ou expiré : reserved -= n uniquement
  const nextStatus = webhookStatus === 'EXPIRED' ? 'expired' : 'failed'
  storeState = {
    ...storeState,
    stock: storeState.stock.map((s) =>
      s.color.toLowerCase() === order.color.toLowerCase() &&
      s.size.toUpperCase() === order.size.toUpperCase()
        ? {
            ...s,
            reserved: Math.max(0, s.reserved - order.quantity),
          }
        : s
    ),
    orders: storeState.orders.map((o) =>
      o.id === order.id ? { ...o, status: nextStatus } : o
    ),
  }

  showToast(
    `Paiement ${nextStatus === 'expired' ? 'expiré' : 'échoué'} : réservation de ${order.quantity} t-shirt(s) libérée.`,
    'error'
  )
  emitChange()
  return { ok: true, message: `Commande marquée ${nextStatus}.` }
}

/**
 * Section 8.4 : Exécution du Cron d'expiration (libère les commandes pending > 15 min)
 */
export function runExpirationCronNow(forceExpireAllPending = false): number {
  const cutoff = Date.now() - 15 * 60 * 1000
  const stale = storeState.orders.filter(
    (o) =>
      o.status === 'pending' &&
      (forceExpireAllPending || o.createdAt < cutoff)
  )

  for (const order of stale) {
    triggerMobileMoneyWebhook(order.paymentReference, 'EXPIRED')
  }
  return stale.length
}

/**
 * Administration du stock (/admin/stock) : updateStock (remplacement) & addStock (+= n)
 */
export function adminUpdateStockVariant(params: {
  color: string
  size: string
  quantity: number
  restockDate?: string
}) {
  const admin = storeState.users.find((u) => u.id === storeState.currentUserId)
  if (!admin || admin.role !== 'admin') {
    showToast('Action réservée aux administrateurs.', 'error')
    return
  }

  const cleanQty = Math.max(0, Math.floor(params.quantity))
  storeState = {
    ...storeState,
    stock: storeState.stock.map((s) =>
      s.color.toLowerCase() === params.color.toLowerCase() &&
      s.size.toUpperCase() === params.size.toUpperCase()
        ? { ...s, quantity: cleanQty, restockDate: params.restockDate }
        : s
    ),
  }
  showToast(
    `Inventaire mis à jour (${params.size} : ${cleanQty} unités).`,
    'success'
  )
  emitChange()
}

export function adminAddStockVariant(params: {
  color: string
  size: string
  addedQuantity: number
}) {
  const admin = storeState.users.find((u) => u.id === storeState.currentUserId)
  if (!admin || admin.role !== 'admin') {
    showToast('Action réservée aux administrateurs.', 'error')
    return
  }

  const delta = Math.floor(params.addedQuantity)
  storeState = {
    ...storeState,
    stock: storeState.stock.map((s) =>
      s.color.toLowerCase() === params.color.toLowerCase() &&
      s.size.toUpperCase() === params.size.toUpperCase()
        ? {
            ...s,
            quantity: Math.max(0, s.quantity + delta),
            restockDate:
              s.quantity + delta > s.reserved ? undefined : s.restockDate,
          }
        : s
    ),
  }
  showToast(
    `Réapprovisionnement (+${delta}) ajouté sans écraser les ventes en cours.`,
    'success'
  )
  emitChange()
}

/**
 * Section 10.A : Génération d'un lien de partage par produit et enregistrement des clics uniques
 */
export function generateProductShareLink(designId: string): string | null {
  if (!storeState.currentUserId) {
    openAuthForProtectedAction({
      type: 'open_route',
      route: `/p/${designId}`,
      designId,
    })
    return null
  }

  const userId = storeState.currentUserId
  const existing = storeState.shareLinks.find(
    (l) => l.userId === userId && l.designId === designId
  )
  if (existing) {
    return `${window.location.origin}/?design=${designId}&ref=${existing.code}`
  }

  const code = `SH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
  storeState = {
    ...storeState,
    shareLinks: [
      {
        code,
        userId,
        designId,
        clicksCount: 0,
        purchasesCount: 0,
        createdAt: Date.now(),
      },
      ...storeState.shareLinks,
    ],
  }
  emitChange()
  return `${window.location.origin}/?design=${designId}&ref=${code}`
}

export function registerIncomingReferralRef(refCode: string, designId?: string) {
  const cleanCode = refCode.trim().toUpperCase()
  if (!cleanCode) return

  saveReferralCodeToBrowser(cleanCode)

  const shareLink = storeState.shareLinks.find((l) => l.code === cleanCode)
  const refOwner = shareLink
    ? storeState.users.find((u) => u.id === shareLink.userId)
    : storeState.users.find((u) => u.referralCode.toUpperCase() === cleanCode)

  if (!refOwner) return

  // Anti-fraude : interdire l'auto-clic
  if (storeState.currentUserId === refOwner.id) return

  const fp = getDeviceFingerprint()
  const dayKey = getTodayKey()
  const alreadyClicked = storeState.trackingClicks.some(
    (c) =>
      c.code === cleanCode && c.deviceFingerprint === fp && c.dayKey === dayKey
  )

  if (alreadyClicked) return

  storeState = {
    ...storeState,
    trackingClicks: [
      ...storeState.trackingClicks,
      {
        code: cleanCode,
        referrerId: refOwner.id,
        designId: designId ?? shareLink?.designId,
        deviceFingerprint: fp,
        dayKey,
      },
    ],
    shareLinks: storeState.shareLinks.map((l) =>
      l.code === cleanCode ? { ...l, clicksCount: l.clicksCount + 1 } : l
    ),
  }

  grantXpInternal(
    refOwner.id,
    'share_link_click',
    `${cleanCode}_${fp}_${dayKey}`
  )
  emitChange()
}

export function adminToggleFeaturedDesign(designId: string, featured: boolean) {
  const admin = storeState.users.find((u) => u.id === storeState.currentUserId)
  if (!admin || admin.role !== 'admin') {
    showToast('Action réservée aux administrateurs.', 'error')
    return
  }

  storeState = {
    ...storeState,
    designs: storeState.designs.map((d) =>
      d.id === designId ? { ...d, featured } : d
    ),
  }
  showToast(
    featured
      ? 'Modèle épinglé dans « Modèles à découvrir » sur l’accueil.'
      : 'Modèle retiré des épinglés de l’accueil.',
    'info'
  )
  emitChange()
}

