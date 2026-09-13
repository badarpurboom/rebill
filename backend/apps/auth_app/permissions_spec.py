"""Canonical specification of permissions available in ReBill.

Grouped by functional modules with human-readable labels and descriptions.
"""

PERMISSION_MODULES = [
    {
        "id": "dashboard",
        "name": "Dashboard & Reports",
        "description": "Access to executive analytics, revenue summary, and reporting.",
        "permissions": [
            {
                "id": "view_dashboard",
                "label": "View Dashboard",
                "description": "Can view executive sales widgets, charts, and today summary metrics.",
            },
            {
                "id": "view_reports",
                "label": "View Reports",
                "description": "Can view detailed sales, item-wise breakdown, and financial reports.",
            },
            {
                "id": "export_reports",
                "label": "Export Reports",
                "description": "Can download and export reports in Excel/CSV format.",
            },
        ],
    },
    {
        "id": "pos",
        "name": "POS & Billing Floor",
        "description": "Counter billing operations, order punching, and payments.",
        "permissions": [
            {
                "id": "view_pos",
                "label": "View POS Screen",
                "description": "Can access POS screen to take orders and view active cart.",
            },
            {
                "id": "punch_order",
                "label": "Punch / Send Order",
                "description": "Can add items to cart, select tables/takeaway, and punch orders.",
            },
            {
                "id": "print_kot",
                "label": "Print KOT",
                "description": "Can generate and print Kitchen Order Tickets.",
            },
            {
                "id": "print_bill",
                "label": "Print Bill Estimate / Invoice",
                "description": "Can print thermal receipts and bill slips.",
            },
            {
                "id": "settle_bill",
                "label": "Settle Bill (Accept Payment)",
                "description": "Can accept Cash/UPI/Card and finalize payment to close bills.",
            },
            {
                "id": "cancel_bill",
                "label": "Cancel / Void Bill",
                "description": "Can cancel or void unpaid bills / running tables.",
            },
            {
                "id": "apply_discount",
                "label": "Apply Cashier Discount",
                "description": "Can give discounts up to the restaurant-configured max limit.",
            },
            {
                "id": "owner_override",
                "label": "Owner Password Override",
                "description": "Can authorize discounts exceeding limit and perform owner approvals.",
            },
        ],
    },
    {
        "id": "tables",
        "name": "Floor Map & Table Management",
        "description": "Table floor visual layout, statuses, and seating.",
        "permissions": [
            {
                "id": "view_floor_map",
                "label": "View Floor Map",
                "description": "Can view table occupancy and table statuses in real-time.",
            },
            {
                "id": "manage_tables",
                "label": "Manage Tables & Layout",
                "description": "Can add, edit, rename, or rearrange floor tables and sections.",
            },
        ],
    },
    {
        "id": "kot",
        "name": "Kitchen Display & KOT",
        "description": "Kitchen live orders display, status updates, and cooking queue.",
        "permissions": [
            {
                "id": "view_kot",
                "label": "View Kitchen Screen",
                "description": "Can view live kitchen orders on KOT / Kitchen Display Screen.",
            },
            {
                "id": "manage_kot",
                "label": "Update KOT Item Status",
                "description": "Can mark items as Preparing, Ready, or Served.",
            },
        ],
    },
    {
        "id": "menu",
        "name": "Menu Catalog & Prices",
        "description": "Dishes, categories, pricing, and stock toggles.",
        "permissions": [
            {
                "id": "view_menu",
                "label": "View Menu Catalog",
                "description": "Can view items list, pricing, and categories.",
            },
            {
                "id": "manage_menu",
                "label": "Manage Menu Items & Prices",
                "description": "Can add, edit, delete dishes, import menu, and modify rates.",
            },
        ],
    },
    {
        "id": "customers",
        "name": "Customers & Loyalty",
        "description": "Customer database, order history, and loyalty points.",
        "permissions": [
            {
                "id": "view_customers",
                "label": "View Customers",
                "description": "Can view customer profiles, visit history, and total spends.",
            },
            {
                "id": "manage_customers",
                "label": "Create & Edit Customers",
                "description": "Can add new customers or update their contact info.",
            },
            {
                "id": "adjust_loyalty_points",
                "label": "Manual Loyalty Adjustment",
                "description": "Can manually add or deduct loyalty points.",
            },
        ],
    },
    {
        "id": "orders",
        "name": "Order History & Refunds",
        "description": "Historical settled receipts, reprints, and refund logs.",
        "permissions": [
            {
                "id": "view_orders",
                "label": "View Order History",
                "description": "Can view past bills and search invoices by date or customer.",
            },
            {
                "id": "refund_bill",
                "label": "Process Refunds / Cancel Settled Bill",
                "description": "Can cancel or refund an already settled bill.",
            },
        ],
    },
    {
        "id": "marketing",
        "name": "Marketing & WhatsApp",
        "description": "Promotional campaigns, coupons, and WhatsApp billing alerts.",
        "permissions": [
            {
                "id": "view_whatsapp",
                "label": "View WhatsApp Console",
                "description": "Can view WhatsApp delivery logs and message templates.",
            },
            {
                "id": "view_coupons",
                "label": "View Coupons",
                "description": "Can view promotional coupon codes and offers.",
            },
            {
                "id": "manage_coupons",
                "label": "Create & Manage Coupons",
                "description": "Can create new coupon codes and discounts.",
            },
        ],
    },
    {
        "id": "settings",
        "name": "Administration & Staff",
        "description": "Restaurant configuration, staff management, and role definitions.",
        "permissions": [
            {
                "id": "view_settings",
                "label": "View Settings",
                "description": "Can view restaurant configuration and GST tax info.",
            },
            {
                "id": "manage_settings",
                "label": "Modify Restaurant Settings",
                "description": "Can update GSTIN, restaurant name, bill prefix, and loyalty rules.",
            },
            {
                "id": "manage_staff",
                "label": "Manage Staff Users",
                "description": "Can create, edit, activate/deactivate staff, and reset passwords.",
            },
            {
                "id": "manage_roles",
                "label": "Manage Roles & Permissions",
                "description": "Can create and edit custom roles and permission matrices.",
            },
        ],
    },
]

ALL_PERMISSIONS = [
    perm["id"]
    for module in PERMISSION_MODULES
    for perm in module["permissions"]
]
