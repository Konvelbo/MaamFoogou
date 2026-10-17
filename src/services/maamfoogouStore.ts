import { useSyncExternalStore } from 'react'
import { ConvexHttpClient } from 'convex/browser'
import {
  DOMAIN_REWARDS,
  computeLevelFromXp,
  type XpActionType,
  type XpDomain,
} from '../../convex/xpConfig'
import type { StockCheckStatus } from '../../convex/stock'
import type { MobileMoneyOperator } from '../../convex/paymentProvider'
import { generateTShirtSvgUrl } from '../utils/tshirtPreviewSvg'

// Constante modifiable du nombre maximum de modèles dans "Modèles à découvrir" (Section 4)
export const FEATURED_DESIGNS_LIMIT = 8

const CONVEX_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONVEX_URL) ||
  'http://127.0.0.1:3210'

export const convexClient = new ConvexHttpClient(CONVEX_URL)

const SESSION_TOKEN_KEY = 'maamfoogou_session_token'
const REF_STORAGE_KEY = 'maamfoogou_ref_tracking_v1'

// Nettoyage immédiat de tout ancien stockage local pour respecter la règle "0 donnée en local"
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('maamfoogou_convex_state_v3')
    localStorage.removeItem('maamfoogou_convex_state_v2')
    localStorage.removeItem('maamfoogou_convex_state_v1')
  } catch {
    // Silencieux
  }
}

export interface NormalizedDesignElement {
  id: string
  side: 'front' | 'back'
  type: 'text' | 'image'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  text?: string
  font?: string
  fontSize?: number
  color?: string
  strokeColor?: string
  strokeWidth?: number
  fileId?: string
  imageUrl?: string
  mimeType?: string
  originalWidth?: number
  originalHeight?: number
  locked?: boolean
}

export interface MaamfoogouDesign {
  id: string
  ownerId: string
  creatorName: string
  source: 'team' | 'creator'
  name: string
  description: string
  theme?: string
  tshirtColor: string
  size: string
  status: 'draft' | 'published'
  price: number
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
  level?: number
  totalXp?: number
  xpByDomain?: Record<XpDomain, number>
  unlockedRewards?: Array<any>
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
  ussdPromptCode?: string
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

export interface StoreDatabaseState {
  currentUserId: string | null
  currentUser: MaamfoogouUser | null
  sessionToken: string | null
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
  trackingClicks: Array<any>
  referrals: Array<ReferralRecord>
}

let currentState: StoreDatabaseState = {
  currentUserId: null,
  currentUser: null,
  sessionToken:
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(SESSION_TOKEN_KEY)
      : null,
  authModalOpen: false,
  pendingAction: null,
  lastToast: null,
  users: [],
  designs: [],
  likes: [],
  comments: [],
  stock: [],
  orders: [],
  xpEvents: [],
  shareLinks: [],
  trackingClicks: [],
  referrals: [],
}

const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function updateState(partial: Partial<StoreDatabaseState>) {
  currentState = { ...currentState, ...partial }
  emitChange()
}

// Convertit un document de la table designs de Convex vers le modèle typé de l'application
function mapConvexDesign(raw: any): MaamfoogouDesign {
  const frontSvg = generateTShirtSvgUrl({
    tshirtColor: raw.tshirtColor || '#111111',
    view: 'front',
    headline: raw.name || 'MAAMFOOGOU',
    subline: raw.creatorName || 'Burkina Faso',
    accentColor: '#D4AF37',
  })
  const backSvg = generateTShirtSvgUrl({
    tshirtColor: raw.tshirtColor || '#111111',
    view: 'back',
    headline: raw.name || 'MAAMFOOGOU',
    subline: 'BURKINA FASO 226',
    accentColor: '#D4AF37',
  })

  return {
    id: String(raw._id || raw.id),
    ownerId: String(raw.ownerId),
    creatorName: raw.creatorName || 'Créateur Maamfoogou',
    source: raw.source || 'team',
    name: raw.name,
    description: raw.description || '',
    theme: raw.theme,
    tshirtColor: raw.tshirtColor || '#111111',
    size: raw.size || 'L',
    status: raw.status || 'published',
    price: raw.price || 12000,
    featured: Boolean(raw.featured),
    likesCount: raw.likesCount || 0,
    commentsCount: raw.commentsCount || 0,
    previewFrontUrl: raw.previewFrontUrl || frontSvg,
    previewBackUrl: raw.previewBackUrl || backSvg,
    printFrontUrl: raw.printFrontUrl,
    printBackUrl: raw.printBackUrl,
    colorVariants: raw.colorVariants || [],
    elements: raw.elements || [],
    createdAt: raw.createdAt || Date.now(),
  }
}

export async function syncFromConvex() {
  try {
    const rawDesigns = await (convexClient as any).query('designs:listCatalogDesigns', {})
    const designs = (rawDesigns || []).map(mapConvexDesign)

    const rawStock = await (convexClient as any).query('stock:getAvailableVariants', {})
    const stock: Array<StockVariantRow> = (rawStock || []).map((s: any) => ({
      id: String(s.id || s._id),
      color: s.color,
      colorName: s.colorName,
      size: s.size,
      quantity: s.quantity,
      reserved: s.reserved,
      lowThreshold: s.lowThreshold,
      restockDate: s.restockDate,
    }))

    // Mettre à jour immédiatement les modèles et les stocks pour le catalogue
    updateState({ designs, stock })

    let currentUser: MaamfoogouUser | null = null
    let orders: Array<MaamfoogouOrder> = []
    let userLikes: Array<{ userId: string; designId: string; createdAt: number }> = []

    if (currentState.sessionToken) {
      try {
        const me = await (convexClient as any).query('users:getMe', {
          sessionToken: currentState.sessionToken,
        })
        if (me) {
          currentUser = {
            id: String(me.id),
            name: me.name,
            email: me.email,
            phone: me.phone,
            geoCoordinates: me.geoCoordinates,
            role: me.role,
            referralCode: me.referralCode,
            createdAt: me.createdAt || Date.now(),
            level: me.level,
            totalXp: me.totalXp,
            xpByDomain: me.xpByDomain,
            unlockedRewards: me.unlockedRewards,
          }

          try {
            const myOrders = await (convexClient as any).query('orders:listMyOrders', {
              sessionToken: currentState.sessionToken,
            })
            orders = (myOrders || []).map((o: any) => ({
              id: String(o.id || o._id),
              userId: String(o.userId),
              designId: String(o.designId),
              designName: o.designName || 'T-shirt Maamfoogou',
              color: o.color,
              size: o.size,
              quantity: o.quantity,
              unitPrice: o.unitPrice,
              totalAmount: o.totalAmount,
              status: o.status,
              paymentProvider: o.paymentProvider,
              paymentReference: o.paymentReference,
              phoneNumber: o.phoneNumber,
              deliveryInfo: o.deliveryInfo,
              referralCodeUsed: o.referralCodeUsed,
              createdAt: o.createdAt,
              paidAt: o.paidAt,
            }))
          } catch {}

          try {
            const likedIds = await (convexClient as any).query('likes:getLikedDesignIds', {
              sessionToken: currentState.sessionToken,
            })
            userLikes = (likedIds || []).map((dId: string) => ({
              userId: currentUser!.id,
              designId: String(dId),
              createdAt: Date.now(),
            }))
          } catch {}
        } else {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(SESSION_TOKEN_KEY)
          }
          currentState.sessionToken = null
        }
      } catch (err) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(SESSION_TOKEN_KEY)
        }
        currentState.sessionToken = null
      }
    }

    // Récupération des commentaires des modèles
    const allComments: Array<MaamfoogouComment> = []
    for (const d of designs.slice(0, 8)) {
      try {
        const paginated = await (convexClient as any).query('comments:listComments', {
          designId: d.id,
          paginationOpts: { numItems: 10, cursor: null },
        })
        if (paginated?.page) {
          for (const c of paginated.page) {
            allComments.push({
              id: String(c.id || c._id),
              designId: String(c.designId),
              userId: String(c.userId),
              authorName: c.authorName,
              authorLevel: c.authorLevel,
              authorRole: c.authorRole,
              text: c.text,
              parentId: c.parentId ? String(c.parentId) : undefined,
              photoUrl: c.photoUrl,
              status: c.status,
              createdAt: c.createdAt,
              editedAt: c.editedAt,
            })
          }
        }
      } catch {}
    }

    updateState({
      currentUser,
      currentUserId: currentUser ? currentUser.id : null,
      users: currentUser ? [currentUser] : [],
      orders,
      likes: userLikes,
      comments: allComments,
    })
  } catch (err) {
    console.error('Erreur synchronisation Convex:', err)
  }
}

// Auto-démarrage client
if (typeof window !== 'undefined') {
  syncFromConvex()
}

export function saveReferralCodeToBrowser(code: string) {
  if (typeof window === 'undefined') return
  const clean = code.trim().toUpperCase()
  if (!clean) return
  try {
    sessionStorage.setItem(REF_STORAGE_KEY, clean)
    document.cookie = `maamfoogou_ref=${encodeURIComponent(clean)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
  } catch {}
}

export function getStoredReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const fromSession = sessionStorage.getItem(REF_STORAGE_KEY)
    if (fromSession) return fromSession
    const cookieMatch = document.cookie.match(/(?:^|;\s*)maamfoogou_ref=([^;]*)/)
    if (cookieMatch?.[1]) {
      return decodeURIComponent(cookieMatch[1])
    }
  } catch {}
  return undefined
}

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server-fp'
  return `fp_${navigator.userAgent.slice(0, 16)}_${window.screen?.width || 0}`
}

export function showToast(text: string, tone: 'success' | 'info' | 'error' = 'info') {
  updateState({
    lastToast: { id: Date.now(), text, tone },
  })
}

export function clearToast() {
  updateState({ lastToast: null })
}

export function useMaamfoogouStore(): StoreDatabaseState {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => currentState,
    () => currentState
  )
}

export function getUserXpSummary(userId: string) {
  const user = currentState.users.find((u) => u.id === userId)
  const totalXp = user?.totalXp || 0
  const levelInfo = computeLevelFromXp(totalXp)
  const xpByDomain = user?.xpByDomain || { achats: 0, partage: 0, creation: 0, communaute: 0 }
  const unlockedRewards = (user?.unlockedRewards || DOMAIN_REWARDS).map((r: any) => ({
    ...r,
    unlocked: (xpByDomain[r.domain as XpDomain] || 0) >= r.requiredDomainXp,
    currentDomainXp: xpByDomain[r.domain as XpDomain] || 0,
  }))

  return {
    totalXp,
    ...levelInfo,
    xpByDomain,
    unlockedRewards,
    recentEvents: [],
  }
}

export function openAuthForProtectedAction(action: PendingProtectedAction | null) {
  updateState({
    authModalOpen: true,
    pendingAction: action,
  })
}

export function closeAuthModal() {
  updateState({
    authModalOpen: false,
    pendingAction: null,
  })
}

export function authenticateUser(params: {
  mode: 'login' | 'register'
  email: string
  password: string
  name?: string
  phone?: string
  city?: string
  district?: string
  referralCode?: string
}): { success: boolean; resumedAction?: PendingProtectedAction; error?: string } {
  const pending = currentState.pendingAction

  // Lancement asynchrone côté serveur Convex
  ;(async () => {
    try {
      const res = await (convexClient as any).mutation('users:authenticate', {
        mode: params.mode,
        email: params.email,
        password: params.password,
        name: params.name,
        phone: params.phone,
        city: params.city,
        district: params.district,
        referralCode: params.referralCode || getStoredReferralCode(),
      })

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_TOKEN_KEY, res.token)
      }

      const newUser: MaamfoogouUser = {
        id: String(res.user.id),
        name: res.user.name,
        email: res.user.email,
        phone: res.user.phone,
        geoCoordinates: res.user.geoCoordinates,
        role: res.user.role,
        referralCode: res.user.referralCode,
        createdAt: Date.now(),
        level: res.user.level,
        totalXp: res.user.totalXp,
        xpByDomain: res.user.xpByDomain,
        unlockedRewards: res.user.unlockedRewards,
      }

      updateState({
        sessionToken: res.token,
        currentUserId: newUser.id,
        currentUser: newUser,
        users: [newUser],
        authModalOpen: false,
        pendingAction: null,
      })

      showToast(
        params.mode === 'register'
          ? `Bienvenue, ${newUser.name} ! +50 XP crédités sur votre compte.`
          : `Bienvenue, ${newUser.name} !`,
        'success'
      )

      if (pending && pending.type === 'like') {
        await toggleDesignLike(pending.designId)
      }

      await syncFromConvex()
    } catch (err: any) {
      showToast(err.message || 'Erreur authentification Convex', 'error')
    }
  })()

  // Résultat synchrone immédiat pour le formulaire
  return {
    success: true,
    resumedAction: pending || undefined,
  }
}

export function logoutUser() {
  if (currentState.sessionToken) {
    ;(convexClient as any)
      .mutation('users:logout', { sessionToken: currentState.sessionToken })
      .catch(() => {})
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
  }
  updateState({
    currentUserId: null,
    currentUser: null,
    sessionToken: null,
    orders: [],
    likes: [],
  })
  showToast('Déconnexion effectuée.', 'info')
}

export function updateUserProfile(params: {
  name: string
  phone: string
  city: string
  district: string
  landmark: string
}) {
  if (!currentState.sessionToken) {
    showToast('Connexion requise.', 'error')
    return
  }
  ;(convexClient as any)
    .mutation('users:updateProfile', {
      sessionToken: currentState.sessionToken,
      ...params,
    })
    .then(() => {
      showToast('Profil synchronisé dans la base Convex.', 'success')
      syncFromConvex()
    })
    .catch((err: any) => {
      showToast(err.message || 'Erreur mise à jour profil', 'error')
    })
}

export async function toggleDesignLike(designId: string): Promise<{
  success: boolean
  liked: boolean
  likesCount: number
  requiresAuth?: boolean
}> {
  if (!currentState.sessionToken) {
    openAuthForProtectedAction({ type: 'like', designId })
    return { success: false, liked: false, likesCount: 0, requiresAuth: true }
  }

  const hasLiked = currentState.likes.some((l) => l.designId === designId)
  const targetDesign = currentState.designs.find((d) => d.id === designId)
  const currentLikesCount = targetDesign?.likesCount || 0
  const nextLiked = !hasLiked
  const nextCount = nextLiked ? currentLikesCount + 1 : Math.max(0, currentLikesCount - 1)

  const nextLikes = nextLiked
    ? [...currentState.likes, { userId: currentState.currentUserId!, designId, createdAt: Date.now() }]
    : currentState.likes.filter((l) => l.designId !== designId)

  const nextDesigns = currentState.designs.map((d) =>
    d.id === designId ? { ...d, likesCount: nextCount } : d
  )

  updateState({ likes: nextLikes, designs: nextDesigns })

  try {
    const res = await (convexClient as any).mutation('likes:toggleLike', {
      sessionToken: currentState.sessionToken,
      designId,
    })
    showToast(
      res.liked
        ? 'Modèle sauvegardé dans Mes collections ("À acheter plus tard")'
        : 'Modèle retiré de vos collections',
      'info'
    )
    return { success: true, liked: res.liked, likesCount: res.likesCount }
  } catch (err: any) {
    await syncFromConvex()
    showToast(err.message || 'Erreur lors du like', 'error')
    return { success: false, liked: hasLiked, likesCount: currentLikesCount }
  }
}

export function addDesignComment(params: {
  designId: string
  text: string
  parentId?: string
  photoUrl?: string
}): { success: boolean; commentId?: string; error?: string } {
  if (!currentState.sessionToken) {
    openAuthForProtectedAction({
      type: 'open_route',
      route: 'product_detail',
      designId: params.designId,
    })
    return { success: false, error: 'Connexion requise pour commenter.' }
  }

  const tempId = `cmt_${Date.now()}`
  const newComment: MaamfoogouComment = {
    id: tempId,
    designId: params.designId,
    userId: currentState.currentUserId!,
    authorName: currentState.currentUser?.name || 'Moi',
    authorLevel: currentState.currentUser?.level || 1,
    authorRole: currentState.currentUser?.role || 'user',
    text: params.text,
    parentId: params.parentId,
    photoUrl: params.photoUrl,
    status: 'visible',
    createdAt: Date.now(),
  }

  updateState({
    comments: [newComment, ...currentState.comments],
    designs: currentState.designs.map((d) =>
      d.id === params.designId ? { ...d, commentsCount: d.commentsCount + 1 } : d
    ),
  })

  ;(convexClient as any)
    .mutation('comments:addComment', {
      sessionToken: currentState.sessionToken,
      designId: params.designId,
      text: params.text,
      parentId: params.parentId,
      photoUrl: params.photoUrl,
    })
    .then(() => {
      showToast('Commentaire enregistré en direct sur Convex !', 'success')
      syncFromConvex()
    })
    .catch((err: any) => {
      showToast(err.message || 'Erreur publication commentaire', 'error')
      syncFromConvex()
    })

  return { success: true, commentId: tempId }
}

export function editDesignComment(commentId: string, newText: string) {
  if (!currentState.sessionToken) return
  updateState({
    comments: currentState.comments.map((c) =>
      c.id === commentId ? { ...c, text: newText, editedAt: Date.now() } : c
    ),
  })
  ;(convexClient as any)
    .mutation('comments:editComment', {
      sessionToken: currentState.sessionToken,
      commentId,
      text: newText,
    })
    .then(() => {
      showToast('Commentaire modifié sur Convex.', 'success')
    })
    .catch((err: any) => {
      showToast(err.message || 'Erreur modification commentaire', 'error')
      syncFromConvex()
    })
}

export function deleteDesignComment(commentId: string) {
  if (!currentState.sessionToken) return
  updateState({
    comments: currentState.comments.filter((c) => c.id !== commentId),
  })
  ;(convexClient as any)
    .mutation('comments:deleteComment', {
      sessionToken: currentState.sessionToken,
      commentId,
    })
    .then(() => {
      showToast('Commentaire supprimé.', 'info')
      syncFromConvex()
    })
    .catch((err: any) => {
      showToast(err.message || 'Erreur suppression commentaire', 'error')
      syncFromConvex()
    })
}

export function reportDesignComment(commentId: string) {
  if (!currentState.sessionToken) {
    openAuthForProtectedAction({ type: 'open_route', route: 'product_detail' })
    return
  }
  ;(convexClient as any)
    .mutation('comments:reportComment', {
      sessionToken: currentState.sessionToken,
      commentId,
    })
    .then(() => {
      showToast('Commentaire signalé aux modérateurs.', 'info')
    })
}

export function moderateDesignComment(
  commentId: string,
  status: 'hidden' | 'visible'
) {
  if (!currentState.sessionToken) return
  updateState({
    comments: currentState.comments.map((c) =>
      c.id === commentId ? { ...c, status } : c
    ),
  })
  ;(convexClient as any)
    .mutation('comments:hideComment', {
      sessionToken: currentState.sessionToken,
      commentId,
      status,
    })
    .then(() => {
      showToast(`Statut mis à jour sur Convex : ${status}.`, 'info')
      syncFromConvex()
    })
}

export function saveNormalizedDesign(params: {
  designId?: string
  name: string
  description?: string
  theme?: string
  tshirtColor: string
  size?: string
  status: 'draft' | 'published'
  price?: number
  previewFrontUrl?: string
  previewBackUrl?: string
  printFrontUrl?: string
  printBackUrl?: string
  elements: Array<NormalizedDesignElement>
}): { success: boolean; designId?: string; error?: string } {
  if (!currentState.sessionToken) {
    openAuthForProtectedAction({ type: 'save_design' })
    return { success: false, error: 'Connexion requise pour sauvegarder.' }
  }

  const tempId = params.designId || `des_${Date.now()}`
  ;(async () => {
    try {
      const res = await (convexClient as any).mutation('designs:saveDesign', {
        sessionToken: currentState.sessionToken,
        designId: params.designId,
        name: params.name,
        description: params.description,
        theme: params.theme,
        tshirtColor: params.tshirtColor,
        size: params.size,
        status: params.status,
        price: params.price,
        previewFrontUrl: params.previewFrontUrl,
        previewBackUrl: params.previewBackUrl,
        printFrontUrl: params.printFrontUrl,
        printBackUrl: params.printBackUrl,
        elements: params.elements,
      })

      showToast('Design sauvegardé dans la base Convex !', 'success')
      await syncFromConvex()
      return res
    } catch (err: any) {
      showToast(err.message || 'Erreur sauvegarde design sur Convex', 'error')
    }
  })()

  return { success: true, designId: tempId }
}

export function checkVariantStockServer(
  color: string,
  size: string,
  quantity = 1
): {
  status: StockCheckStatus
  available: number
  quantity: number
  reserved: number
  lowThreshold: number
  restockDate?: string
  message: string | null
} {
  const row = currentState.stock.find((s) => s.color === color && s.size === size)
  if (!row) {
    return {
      status: 'available',
      available: 20,
      quantity: 20,
      reserved: 0,
      lowThreshold: 5,
      message: null,
    }
  }

  const available = Math.max(0, row.quantity - row.reserved)
  const threshold = row.lowThreshold ?? 5

  if (available === 0) {
    return {
      status: 'out_of_stock',
      available: 0,
      quantity: row.quantity,
      reserved: row.reserved,
      lowThreshold: threshold,
      restockDate: row.restockDate,
      message: row.restockDate
        ? `Rupture de stock • Réapprovisionnement le ${row.restockDate}`
        : 'Rupture de stock sur cette variante',
    }
  }

  if (available < quantity) {
    return {
      status: 'partial',
      available,
      quantity: row.quantity,
      reserved: row.reserved,
      lowThreshold: threshold,
      restockDate: row.restockDate,
      message: `Seulement ${available} pièce(s) disponible(s)`,
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
      message: `Plus que ${available} exemplaire(s) en stock`,
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
  referralCode?: string
  instantTestMode?: boolean
}): { success: boolean; order?: MaamfoogouOrder; error?: string } {
  if (!currentState.sessionToken) {
    openAuthForProtectedAction({ type: 'buy_now', designId: params.designId })
    return { success: false, error: 'Connexion requise pour commander.' }
  }

  const design = currentState.designs.find((d) => d.id === params.designId)
  const unitPrice = design?.price || 12000
  const totalAmount = unitPrice * params.quantity
  const paymentRef = `PAY-TEST-${Date.now().toString(36).toUpperCase()}`
  const orderId = `ord_${Date.now()}`

  const newOrder: MaamfoogouOrder = {
    id: orderId,
    userId: currentState.currentUserId!,
    designId: params.designId,
    designName: design?.name || 'T-shirt Maamfoogou',
    color: params.color,
    size: params.size,
    quantity: params.quantity,
    unitPrice,
    totalAmount,
    status: params.instantTestMode ? 'paid' : 'pending',
    paymentProvider: params.operator,
    paymentReference: paymentRef,
    phoneNumber: params.phoneNumber,
    deliveryInfo: {
      fullName: params.fullName,
      phone: params.phoneNumber,
      city: params.city,
      district: params.district,
      landmark: params.landmark,
    },
    referralCodeUsed: params.referralCode || getStoredReferralCode(),
    createdAt: Date.now(),
    paidAt: params.instantTestMode ? Date.now() : undefined,
  }

  updateState({ orders: [newOrder, ...currentState.orders] })

  ;(convexClient as any)
    .mutation('orders:createOrder', {
      sessionToken: currentState.sessionToken,
      designId: params.designId,
      color: params.color,
      size: params.size,
      quantity: params.quantity,
      operator: params.operator,
      phoneNumber: params.phoneNumber,
      fullName: params.fullName,
      city: params.city,
      district: params.district,
      landmark: params.landmark,
      referralCode: params.referralCode || getStoredReferralCode(),
      instantTestMode: params.instantTestMode,
    })
    .then(() => {
      showToast(
        params.instantTestMode
          ? 'Commande validée en Mode Test sur Convex !'
          : 'Commande enregistrée en attente sur Convex.',
        'success'
      )
      syncFromConvex()
    })
    .catch((err: any) => {
      showToast(err.message || 'Erreur commande Convex', 'error')
      syncFromConvex()
    })

  return { success: true, order: newOrder }
}

export function triggerMobileMoneyWebhook(
  paymentReference: string,
  outcome: 'SUCCESS' | 'FAILED' | 'EXPIRED'
): { success: boolean; message: string } {
  if (!currentState.sessionToken) {
    return { success: false, message: 'Non authentifié' }
  }

  const nextStatus = outcome === 'SUCCESS' ? 'paid' : outcome === 'EXPIRED' ? 'expired' : 'failed'
  updateState({
    orders: currentState.orders.map((o) =>
      o.paymentReference === paymentReference
        ? { ...o, status: nextStatus, paidAt: outcome === 'SUCCESS' ? Date.now() : o.paidAt }
        : o
    ),
  })

  ;(convexClient as any)
    .mutation('orders:simulateTestWebhook', {
      sessionToken: currentState.sessionToken,
      paymentReference,
      outcome,
    })
    .then(() => {
      showToast(`Paiement ${outcome} confirmé sur Convex.`, 'info')
      syncFromConvex()
    })
    .catch((err: any) => {
      showToast(err.message || 'Erreur webhook Convex', 'error')
    })

  return { success: true, message: `Paiement ${outcome} exécuté.` }
}

export function runExpirationCronNow(_forceExpireAllPending = false): number {
  return 0
}

export function adminUpdateStockVariant(params: {
  color: string
  colorName?: string
  size: string
  quantity: number
  lowThreshold?: number
  restockDate?: string
}) {
  if (!currentState.sessionToken) return
  ;(convexClient as any)
    .mutation('stock:updateStock', {
      sessionToken: currentState.sessionToken,
      ...params,
    })
    .then(() => {
      showToast('Stock mis à jour sur Convex.', 'success')
      syncFromConvex()
    })
}

export function adminAddStockVariant(params: {
  color: string
  size: string
  addedQuantity: number
  restockDate?: string
}) {
  if (!currentState.sessionToken) return
  ;(convexClient as any)
    .mutation('stock:addStock', {
      sessionToken: currentState.sessionToken,
      ...params,
    })
    .then(() => {
      showToast('Réapprovisionnement enregistré sur Convex.', 'success')
      syncFromConvex()
    })
}

export function generateProductShareLink(designId: string): string | null {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const myCode = currentState.currentUser?.referralCode || 'REF226'
  const shareUrl = `${base}/?design=${designId}&ref=${myCode}`

  if (currentState.sessionToken) {
    ;(convexClient as any)
      .mutation('referrals:getOrCreateShareLink', {
        sessionToken: currentState.sessionToken,
        designId,
      })
      .catch(() => {})
  }

  showToast('Lien de partage copié dans le presse-papier !', 'success')
  return shareUrl
}

export function registerIncomingReferralRef(refCode: string, designId?: string) {
  saveReferralCodeToBrowser(refCode)
  ;(convexClient as any)
    .mutation('referrals:recordShareClick', {
      code: refCode,
      designId,
      deviceFingerprint: getDeviceFingerprint(),
      sessionToken: currentState.sessionToken || undefined,
    })
    .catch(() => {})
}

export function adminToggleFeaturedDesign(designId: string, featured: boolean) {
  if (!currentState.sessionToken) return
  updateState({
    designs: currentState.designs.map((d) =>
      d.id === designId ? { ...d, featured } : d
    ),
  })
  ;(convexClient as any)
    .mutation('designs:toggleFeaturedDesign', {
      sessionToken: currentState.sessionToken,
      designId,
      featured,
    })
    .then(() => {
      syncFromConvex()
    })
}
