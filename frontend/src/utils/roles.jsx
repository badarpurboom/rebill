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
  IconCompass,
  IconSettings,
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
  { to: '/explore', label: 'Explore', icon: <IconCompass />, permission: 'view_explore' },
  { to: '/settings', label: 'Settings', icon: <IconSettings />, permission: 'view_settings' },
]

export const PERMISSION_MODULES = [
  {
    id: 'dashboard',
    name: 'Dashboard & Reports',
    icon: '📊',
    description: 'Executive sales overview, analytics charts, and financial reports',
    permissions: [
      { id: 'view_dashboard', label: 'View Dashboard', description: 'Access today summary stats & sales widgets' },
      { id: 'view_reports', label: 'View Reports', description: 'Access sales, item-wise breakdown, and tax reports' },
      { id: 'export_reports', label: 'Export Reports', description: 'Download Excel & CSV report files' },
    ],
  },
  {
    id: 'pos',
    name: 'POS & Billing Floor',
    icon: '💳',
    description: 'Billing screen, order punching, receipts, discounts & settling bills',
    permissions: [
      { id: 'view_pos', label: 'View POS Screen', description: 'Open the counter POS order screen' },
      { id: 'punch_order', label: 'Punch / Send Orders', description: 'Add dishes to cart and send KOT' },
      { id: 'print_kot', label: 'Print KOT Slip', description: 'Print kitchen order slips to thermal printer' },
      { id: 'print_bill', label: 'Print Bill / Invoice', description: 'Print customer invoice receipts' },
      { id: 'settle_bill', label: 'Settle Bill (Accept Payment)', description: 'Collect Cash/UPI/Card and finalize payment' },
      { id: 'cancel_bill', label: 'Cancel / Void Bill', description: 'Cancel running orders or void unpaid bills' },
      { id: 'apply_discount', label: 'Apply Cashier Discount', description: 'Give discounts up to standard limit' },
      { id: 'owner_override', label: 'Owner Override Approvals', description: 'Authorize discounts exceeding limit & special approvals' },
    ],
  },
  {
    id: 'tables',
    name: 'Floor Map & Tables',
    icon: '🗺️',
    description: 'Visual table map layout, seating, and table management',
    permissions: [
      { id: 'view_floor_map', label: 'View Floor Map', description: 'View real-time table statuses & occupancy' },
      { id: 'manage_tables', label: 'Manage Tables & Sections', description: 'Add, rename, or rearrange floor tables' },
    ],
  },
  {
    id: 'kot',
    name: 'Kitchen Display (KOT)',
    icon: '🍳',
    description: 'Kitchen screen and dish preparation queue',
    permissions: [
      { id: 'view_kot', label: 'View Kitchen Screen', description: 'View live order cards in the kitchen' },
      { id: 'manage_kot', label: 'Update Cooking Status', description: 'Mark dishes as Preparing, Ready, or Served' },
    ],
  },
  {
    id: 'menu',
    name: 'Menu Catalog & Pricing',
    icon: '📋',
    description: 'Dishes, rates, categories, and stock availability',
    permissions: [
      { id: 'view_menu', label: 'View Menu Items', description: 'View list of menu items and prices' },
      { id: 'manage_menu', label: 'Add / Edit Menu Items', description: 'Modify prices, add new items, and import catalog' },
    ],
  },
  {
    id: 'customers',
    name: 'Customers & Loyalty',
    icon: '👥',
    description: 'Customer contact directory and loyalty rewards points',
    permissions: [
      { id: 'view_customers', label: 'View Customers', description: 'Browse customer list and lifetime spends' },
      { id: 'manage_customers', label: 'Create & Edit Customers', description: 'Add new customers or update phone numbers' },
      { id: 'adjust_loyalty_points', label: 'Adjust Loyalty Points', description: 'Manually credit or debit customer points' },
    ],
  },
  {
    id: 'orders',
    name: 'Order History & Refunds',
    icon: '📜',
    description: 'Past settled bills archive, reprints, and refund logs',
    permissions: [
      { id: 'view_orders', label: 'View Order History', description: 'Search past bills and reprint receipts' },
      { id: 'refund_bill', label: 'Refund / Cancel Settled Bill', description: 'Cancel already settled invoices and refund payment' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & WhatsApp',
    icon: '💬',
    description: 'Promotional WhatsApp campaigns and discount coupons',
    permissions: [
      { id: 'view_whatsapp', label: 'View WhatsApp Console', description: 'View delivery logs and message templates' },
      { id: 'view_coupons', label: 'View Coupon Codes', description: 'Browse active discount coupons' },
      { id: 'manage_coupons', label: 'Create & Edit Coupons', description: 'Create new promo discount codes' },
    ],
  },
  {
    id: 'settings',
    name: 'Administration & Staff',
    icon: '⚙️',
    description: 'Restaurant profile, GST settings, staff accounts & custom roles',
    permissions: [
      { id: 'view_settings', label: 'View Settings', description: 'View restaurant configuration' },
      { id: 'manage_settings', label: 'Modify Restaurant Settings', description: 'Edit GSTIN, address, bill numbering, and rules' },
      { id: 'manage_staff', label: 'Manage Staff Users', description: 'Create staff accounts, change passwords & roles' },
      { id: 'manage_roles', label: 'Manage Custom Roles', description: 'Create and configure custom permission roles' },
    ],
  },
]

export const ROLE_PRESETS = [
  {
    name: 'Manager',
    description: 'Full restaurant management except owner password override',
    permissions: {
      view_dashboard: true,
      view_reports: true,
      export_reports: true,
      view_pos: true,
      punch_order: true,
      print_kot: true,
      print_bill: true,
      settle_bill: true,
      cancel_bill: true,
      apply_discount: true,
      view_floor_map: true,
      manage_tables: true,
      view_kot: true,
      manage_kot: true,
      view_menu: true,
      manage_menu: true,
      view_customers: true,
      manage_customers: true,
      adjust_loyalty_points: true,
      view_orders: true,
      refund_bill: true,
      view_whatsapp: true,
      view_coupons: true,
      manage_coupons: true,
      view_settings: true,
      manage_settings: false,
      manage_staff: true,
      manage_roles: false,
    },
  },
  {
    name: 'Cashier',
    description: 'Billing counter, taking orders, and receiving payments',
    permissions: {
      view_dashboard: true,
      view_pos: true,
      punch_order: true,
      print_kot: true,
      print_bill: true,
      settle_bill: true,
      cancel_bill: true,
      apply_discount: true,
      view_floor_map: true,
      view_kot: true,
      view_menu: true,
      view_customers: true,
      manage_customers: true,
      view_orders: true,
      view_coupons: true,
    },
  },
  {
    name: 'Waiter',
    description: 'Table order punching and KOT printing',
    permissions: {
      view_dashboard: true,
      view_pos: true,
      punch_order: true,
      print_kot: true,
      print_bill: true,
      settle_bill: false,
      view_floor_map: true,
      view_kot: true,
      view_menu: true,
      view_customers: true,
    },
  },
  {
    name: 'Chef / Kitchen Head',
    description: 'Kitchen display screen only',
    permissions: {
      view_kot: true,
      manage_kot: true,
      view_menu: true,
    },
  },
]

export function hasPermission(user, permission) {
  if (!user) return false
  if (!permission || permission === 'view_explore') return true
  if (user.is_superuser) return true
  if (user.is_owner) return true

  if (user.custom_role && user.custom_role.permissions) {
    if (user.custom_role.name?.toLowerCase() === 'owner') return true
    return user.custom_role.permissions[permission] === true
  }

  // Fallback if not fully migrated
  if (user.role === 'OWNER') return true
  if (user.role === 'CASHIER') {
    return [
      'view_dashboard', 'view_pos', 'view_floor_map', 'view_kot',
      'view_menu', 'view_customers', 'view_orders', 'punch_order',
      'print_kot', 'print_bill', 'settle_bill', 'cancel_bill', 'apply_discount',
      'view_explore', 'view_coupons', 'view_whatsapp', 'view_reports'
    ].includes(permission)
  }
  if (user.role === 'WAITER') {
    return [
      'view_dashboard', 'view_pos', 'view_floor_map', 'view_kot',
      'punch_order', 'print_kot', 'print_bill', 'view_menu', 'view_explore'
    ].includes(permission)
  }
  return false
}

export function navFor(user) {
  return NAV.filter((entry) => hasPermission(user, entry.permission))
}

/** Where a user lands right after login — their main job, not a generic home. */
export function landingPath(user) {
  if (!user) return '/login'
  if (hasPermission(user, 'view_dashboard')) return '/'
  if (hasPermission(user, 'view_pos')) return '/pos'
  if (hasPermission(user, 'view_kot')) return '/kot'
  if (hasPermission(user, 'view_floor_map')) return '/tables'
  return '/'
}


