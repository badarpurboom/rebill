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

/**
 * Single source of truth for navigation + route guards.
 * Uses specific granular permissions.
 */
export const NAV = [
  { to: '/', label: 'Dashboard', icon: <IconDashboard />, permission: 'view_dashboard' },
  { to: '/pos', label: 'Billing POS', icon: <IconPos />, permission: 'view_pos' },
  { to: '/tables', label: 'Floor Map', icon: <IconTables />, permission: 'view_floor_map' },
  { to: '/kot', label: 'KOT Display', icon: <IconChefHat />, permission: 'view_kot' },
  { to: '/menu', label: 'Menu Catalog', icon: <IconMenu />, permission: 'view_menu' },
  { to: '/customers', label: 'Customers', icon: <IconSparkles />, permission: 'view_customers' },
  { to: '/orders', label: 'Order History', icon: <IconOrders />, permission: 'view_orders' },
  { to: '/whatsapp', label: 'WhatsApp', icon: <IconWhatsApp />, permission: 'view_whatsapp' },
  { to: '/coupons', label: 'Coupons', icon: <IconReceipt />, permission: 'view_coupons' },
  { to: '/reports', label: 'Reports', icon: <IconDashboard />, permission: 'view_reports' },
  { to: '/settings', label: 'Settings', icon: <IconSparkles />, permission: 'view_settings' },
]

export function hasPermission(user, permission) {
  if (!user) return false
  if (user.custom_role && user.custom_role.permissions) {
    return user.custom_role.permissions[permission] === true
  }
  // Fallback if not fully migrated
  if (user.role === 'OWNER') return true
  if (user.role === 'CASHIER') {
    return [
      'view_dashboard', 'view_pos', 'view_floor_map', 'view_kot',
      'view_menu', 'view_customers', 'view_orders', 'punch_order',
      'print_kot', 'print_bill', 'settle_bill', 'cancel_bill'
    ].includes(permission)
  }
  if (user.role === 'WAITER') {
    return ['view_dashboard', 'view_pos', 'view_floor_map', 'view_kot', 'punch_order', 'print_kot', 'print_bill'].includes(permission)
  }
  return false
}

export function navFor(user) {
  return NAV.filter((entry) => hasPermission(user, entry.permission))
}

/** Where a user lands right after login — their main job, not a generic home. */
export function landingPath(user) {
  if (hasPermission(user, 'view_pos') && !hasPermission(user, 'view_reports')) return '/pos' // Waiters & Cashiers
  if (hasPermission(user, 'view_kot') && !hasPermission(user, 'view_pos')) return '/kot' // Pure Kitchen staff
  return '/' // Owners
}

