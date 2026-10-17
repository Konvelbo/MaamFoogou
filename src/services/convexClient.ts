import type { OrderRecord } from '../types/configurator'
export { convexClient } from './maamfoogouStore'

export const isConvexConfigured = true

export async function uploadCustomDesignToConvex() {
  return null
}

export async function submitOrderToConvex() {
  return null
}

export async function saveOrderToBackend(params: any): Promise<OrderRecord> {
  return {
    id: `ord_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'reçue',
    shipping: params.shipping,
    items: params.cartItems || [],
    totalAmount: params.totalAmount,
    stripeSessionId: params.stripeSessionId,
  }
}

export async function verifyAdminCredentials() {
  return null
}

export async function fetchAllOrders(): Promise<Array<OrderRecord>> {
  return []
}

export async function fetchAllOrdersAdmin(): Promise<Array<OrderRecord>> {
  return []
}

export async function updateOrderStatus(_orderId: string, _status: any): Promise<boolean> {
  return true
}

export async function updateOrderStatusAdmin(): Promise<{ success: boolean }> {
  return { success: true }
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  return null
}

export async function signInAdmin(
  _email: string,
  _pass: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  return { success: true, email: _email }
}

export async function signOutAdmin(): Promise<void> {
  // no-op
}
