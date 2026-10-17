import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type {
  CartItem,
  OrderRecord,
  OrderStatus,
  ShippingAddress,
} from '../types/configurator'

const convexUrl = import.meta.env.VITE_CONVEX_URL || ''

export const isConvexConfigured = Boolean(convexUrl)

// Client HTTP Convex initialisé si VITE_CONVEX_URL est renseigné
export const convexClient = isConvexConfigured
  ? new ConvexHttpClient(convexUrl)
  : null

const LOCAL_ORDERS_KEY = 'faso_design_convex_orders_v1'
const LOCAL_ADMIN_SESSION_KEY = 'faso_design_convex_admin_v1'

/**
 * Convertit un fichier File en DataURL (utilisé en mode local ou en secours)
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image'))
    reader.readAsDataURL(file)
  })
}

/**
 * Convertit une DataURL base64 en Blob pour l'envoi vers Convex Storage
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mimeMatch = parts[0]?.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(parts[1] || '')
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

/**
 * Téléverse un Blob ou un File vers Convex File Storage via generateUploadUrl
 */
async function uploadBlobToConvexStorage(
  blob: Blob
): Promise<{ storageId?: string; url?: string }> {
  if (!convexClient) return {}

  try {
    const uploadUrl = await convexClient.mutation(api.orders.generateUploadUrl, {})
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    })

    if (!response.ok) return {}
    const { storageId } = (await response.json()) as { storageId: string }
    const publicUrl = await convexClient.mutation(api.orders.getStorageUrl, {
      storageId,
    })

    return {
      storageId,
      url: publicUrl || undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Téléverse l'image originale haute résolution dans Convex Storage
 */
export async function uploadOriginalImage(
  file: File | undefined,
  fallbackUrl: string | undefined
): Promise<{ storageId?: string; url: string }> {
  if (!file) {
    return { url: fallbackUrl || '' }
  }

  if (convexClient) {
    const uploaded = await uploadBlobToConvexStorage(file)
    if (uploaded.url) {
      return { storageId: uploaded.storageId, url: uploaded.url }
    }
  }

  const dataUrl = await fileToDataUrl(file)
  return { url: dataUrl }
}

/**
 * Téléverse l'aperçu PNG 3D (devant ou dos) dans Convex Storage
 */
export async function uploadPreviewPng(
  dataUrl: string
): Promise<{ storageId?: string; url: string }> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return { url: dataUrl }
  }

  if (convexClient) {
    const blob = dataUrlToBlob(dataUrl)
    const uploaded = await uploadBlobToConvexStorage(blob)
    if (uploaded.url) {
      return { storageId: uploaded.storageId, url: uploaded.url }
    }
  }

  return { url: dataUrl }
}

/**
 * Enregistre une commande dans Convex (base de données + stockage des images HD et aperçus PNG)
 */
export async function saveOrderToBackend(params: {
  shipping: ShippingAddress
  cartItems: Array<CartItem>
  totalAmount: number
  stripeSessionId: string
}): Promise<OrderRecord> {
  const createdAt = new Date().toISOString()
  const processedItems: OrderRecord['items'] = []
  const convexItemsPayload: Array<Record<string, unknown>> = []

  for (const item of params.cartItems) {
    const frontUploaded = await uploadPreviewPng(item.frontPreviewDataUrl)
    const backUploaded = await uploadPreviewPng(item.backPreviewDataUrl)

    const processedElements = await Promise.all(
      item.elements.map(async (el) => {
        let originalImageUrl = el.imageUrl
        let originalStorageId: string | undefined
        if (el.type === 'image') {
          const origUploaded = await uploadOriginalImage(
            el.originalFile,
            el.imageUrl
          )
          originalImageUrl = origUploaded.url
          originalStorageId = origUploaded.storageId
        }
        return {
          id: el.id,
          type: el.type,
          side: el.side,
          position: el.position,
          rotation: el.rotation,
          scale: el.scale,
          originalStorageId,
          originalImageUrl,
          originalFileName: el.originalFileName,
          text: el.text,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize,
          textColor: el.textColor,
          strokeColor: el.strokeColor,
          strokeWidth: el.strokeWidth,
        }
      })
    )

    processedItems.push({
      productName: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      frontPreviewUrl: frontUploaded.url,
      backPreviewUrl: backUploaded.url,
      elements: processedElements,
    })

    convexItemsPayload.push({
      productName: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      frontPreviewStorageId: frontUploaded.storageId,
      frontPreviewUrl: frontUploaded.url,
      backPreviewStorageId: backUploaded.storageId,
      backPreviewUrl: backUploaded.url,
      elements: processedElements,
    })
  }

  let orderId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ord-${Date.now()}`

  // Enregistrement dans la base Convex si connectée
  if (convexClient) {
    try {
      const insertedId = await convexClient.mutation(api.orders.createOrder, {
        createdAt,
        shipping: params.shipping,
        totalAmount: params.totalAmount,
        stripeSessionId: params.stripeSessionId,
        items: convexItemsPayload,
      })
      if (insertedId) {
        orderId = String(insertedId)
      }
    } catch {
      // Sauvegarde locale assurée en secours
    }
  }

  const newOrder: OrderRecord = {
    id: orderId,
    createdAt,
    status: 'reçue',
    shipping: params.shipping,
    totalAmount: params.totalAmount,
    stripeSessionId: params.stripeSessionId,
    items: processedItems,
  }

  const existing = getLocalOrders()
  const updated = [newOrder, ...existing]
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updated))
  }

  return newOrder
}

function getLocalOrders(): Array<OrderRecord> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Array<OrderRecord>
  } catch {
    return []
  }
}

function getLocalAdminToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_SESSION_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { token?: string }
    return parsed.token
  } catch {
    return undefined
  }
}

/**
 * Récupère toutes les commandes depuis Convex (ou depuis le stockage local en mode démo)
 */
export async function fetchAllOrders(): Promise<Array<OrderRecord>> {
  if (convexClient) {
    try {
      const adminToken = getLocalAdminToken()
      const orders = await convexClient.query(api.orders.listOrders, {
        adminToken,
      })
      if (Array.isArray(orders) && orders.length > 0) {
        return orders as Array<OrderRecord>
      }
    } catch {
      // Repli sur le cache local
    }
  }

  return getLocalOrders()
}

/**
 * Met à jour le statut d'une commande dans Convex (reçue, en production, expédiée, livrée)
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<void> {
  if (convexClient) {
    try {
      const adminToken = getLocalAdminToken()
      await convexClient.mutation(api.orders.updateOrderStatus, {
        orderId,
        status: newStatus,
        adminToken,
      })
    } catch {
      // Mise à jour locale ci-dessous
    }
  }

  if (typeof window !== 'undefined') {
    const orders = getLocalOrders()
    const next = orders.map((o) =>
      o.id === orderId ? { ...o, status: newStatus } : o
    )
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next))
  }
}

/**
 * Authentification Administrateur via Convex (mutation api.auth.loginAdmin)
 */
export async function signInAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; email?: string }> {
  if (convexClient) {
    try {
      const res = (await convexClient.mutation(api.auth.loginAdmin, {
        email,
        password,
      })) as {
        success: boolean
        token?: string
        email?: string
        error?: string
      }

      if (res.success && res.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            LOCAL_ADMIN_SESSION_KEY,
            JSON.stringify({ email: res.email || email, token: res.token })
          )
        }
        return { success: true, email: res.email || email }
      }
      if (!res.success) {
        return { success: false, error: res.error || 'Accès refusé' }
      }
    } catch {
      // Repli sur la vérification locale si le déploiement Convex n'est pas encore démarré
    }
  }

  const expectedEmail =
    import.meta.env.VITE_ADMIN_DEMO_EMAIL || 'admin@fasodesign.com'
  const expectedPassword =
    import.meta.env.VITE_ADMIN_DEMO_PASSWORD || 'Admin3D!2026'

  if (
    email.trim().toLowerCase() === expectedEmail.toLowerCase() &&
    password === expectedPassword
  ) {
    const token = `local_cvx_${Date.now()}`
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        LOCAL_ADMIN_SESSION_KEY,
        JSON.stringify({ email, token })
      )
    }
    return { success: true, email }
  }

  return {
    success: false,
    error: `Identifiants invalides (Démo : ${expectedEmail} / ${expectedPassword})`,
  }
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(LOCAL_ADMIN_SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { email: string; token?: string }
    if (convexClient && parsed.token && !parsed.token.startsWith('local_')) {
      const verified = await convexClient.query(api.auth.verifyAdminSession, {
        token: parsed.token,
      })
      if (verified) return verified
    }
    return { email: parsed.email }
  } catch {
    return null
  }
}

export async function signOutAdmin(): Promise<void> {
  if (typeof window !== 'undefined') {
    const token = getLocalAdminToken()
    if (convexClient && token && !token.startsWith('local_')) {
      try {
        await convexClient.mutation(api.auth.logoutAdmin, { token })
      } catch {
        // Ignorer l'erreur réseau à la déconnexion
      }
    }
    localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY)
  }
}
