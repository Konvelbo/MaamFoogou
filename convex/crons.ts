import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

/**
 * Cron Convex toutes les 5 minutes (Section 8.4) :
 * Annule automatiquement les commandes "pending" de plus de 15 minutes
 * et libère leur stock réservé (reserved -= n).
 */
crons.interval(
  'release-expired-stock-reservations',
  { minutes: 5 },
  internal.orders.expireStalePendingOrders,
  {}
)

export default crons
