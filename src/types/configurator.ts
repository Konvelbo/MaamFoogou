// Types principaux pour le configurateur 3D, la boutique, le panier et l'administration

export type TShirtSide = 'front' | 'back'

export type TShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

export type OrderStatus = 'reçue' | 'en production' | 'expédiée' | 'livrée'

export type DesignElementType = 'image' | 'text'

export interface DesignElement {
  id: string
  type: DesignElementType
  side: TShirtSide
  // Position normalisée sur la zone d'impression (-0.22 à 0.22 en X, -0.25 à 0.25 en Y)
  position: [number, number, number]
  // Rotation en radians autour de l'axe Z (normal au tissu)
  rotation: number
  // Échelle (largeur/hauteur du décalque sur le t-shirt)
  scale: number
  // Propriétés spécifiques à une image importée
  imageUrl?: string
  originalFileName?: string
  originalFile?: File
  aspectRatio?: number
  imageResolution?: { width: number; height: number }
  // Propriétés spécifiques à un texte
  text?: string
  fontFamily?: string
  fontSize?: number
  textColor?: string
  strokeColor?: string
  strokeWidth?: number
  // Verrouillage de l'élément (empêche déplacement, redimensionnement ou suppression accidentels)
  locked?: boolean
}

export interface CustomizerState {
  color: string
  size: TShirtSize
  activeSide: TShirtSide
  zoom: number
  elements: Array<DesignElement>
  selectedElementId: string | null
  rightsConfirmed: boolean
}

export interface CustomizerSnapshot {
  color: string
  size: TShirtSize
  elements: Array<DesignElement>
}

export interface CatalogProduct {
  id: string
  name: string
  description: string
  price: number
  defaultColor: string
  defaultSize: TShirtSize
  elements: Array<DesignElement>
}

export interface CartItem {
  id: string
  productName: string
  color: string
  size: TShirtSize
  quantity: number
  unitPrice: number
  elements: Array<DesignElement>
  frontPreviewDataUrl: string
  backPreviewDataUrl: string
  rightsConfirmed: boolean
}

export interface ShippingAddress {
  fullName: string
  email: string
  phone: string
  addressLine: string
  city: string
  postalCode: string
  country: string
}

export interface OrderRecord {
  id: string
  createdAt: string
  status: OrderStatus
  shipping: ShippingAddress
  totalAmount: number
  stripeSessionId: string
  items: Array<{
    productName: string
    color: string
    size: TShirtSize
    quantity: number
    unitPrice: number
    frontPreviewUrl: string
    backPreviewUrl: string
    elements: Array<{
      id: string
      type: DesignElementType
      side: TShirtSide
      position: [number, number, number]
      rotation: number
      scale: number
      originalImageUrl?: string
      originalFileName?: string
      text?: string
      fontFamily?: string
      fontSize?: number
      textColor?: string
      strokeColor?: string
      strokeWidth?: number
    }>
  }>
}
