import {
  IconDashboard,
  IconPos,
  IconTables,
  IconChefHat,
  IconMenu,
  IconOrders,
  IconWhatsApp,
  IconReceipt,
  IconSparkles,
} from '@/components/ui/Icons'

export const ROLES = {
  OWNER: 'OWNER',
  CASHIER: 'CASHIER',
  WAITER: 'WAITER',
}

export const ROLE_LABEL = {
  OWNER: 'Owner',
  CASHIER: 'Cashier',
  WAITER: 'Waiter',
}

/**
 * Single source of truth for navigation + route guards.
 * Uses clean SVG vector icons matching Lumière POS design.
 */
export const NAV = [
  { to: '/', label: 'Dashboard', icon: <IconDashboard />, roles: [ROLES.OWNER, ROLES.CASHIER, ROLES.WAITER] },
  { to: '/pos', label: 'Billing POS', icon: <IconPos />, roles: [ROLES.OWNER, ROLES.CASHIER] },
  { to: '/tables', label: 'Floor Map', icon: <IconTables />, roles: [ROLES.OWNER, ROLES.CASHIER] },
  { to: '/kot', label: 'KOT Display', icon: <IconChefHat />, roles: [ROLES.OWNER, ROLES.CASHIER, ROLES.WAITER] },
  { to: '/menu', label: 'Menu Catalog', icon: <IconMenu />, roles: [ROLES.OWNER, ROLES.CASHIER] },
  { to: '/customers', label: 'Customers', icon: <IconSparkles />, roles: [ROLES.OWNER, ROLES.CASHIER] },
  { to: '/orders', label: 'Order History', icon: <IconOrders />, roles: [ROLES.OWNER, ROLES.CASHIER] },
  { to: '/whatsapp', label: 'WhatsApp', icon: <IconWhatsApp />, roles: [ROLES.OWNER] },
  { to: '/coupons', label: 'Coupons', icon: <IconReceipt />, roles: [ROLES.OWNER] },
  { to: '/reports', label: 'Reports', icon: <IconDashboard />, roles: [ROLES.OWNER] },
  { to: '/settings', label: 'Settings', icon: <IconSparkles />, roles: [ROLES.OWNER] },
]

export function navFor(role) {
  return NAV.filter((entry) => entry.roles.includes(role))
}

/** Where a user lands right after login — their main job, not a generic home. */
export function landingPath(role) {
  if (role === ROLES.CASHIER) return '/pos'
  if (role === ROLES.WAITER) return '/kot'
  return '/'
}
