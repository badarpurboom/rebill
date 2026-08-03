# 🍽️ ReBill — Restaurant Billing & WhatsApp Engagement System
## 📋 Complete Project Requirements & Tech Stack Document
> ✅ Saare sawal pooche ja chuke hain. Koi confusion nahi. Yeh FINAL build reference hai.
> 📅 Date: 27 July 2026

---

# PART 1 — REQUIREMENTS

---

## 🏠 1. Restaurant Setup
| Field | Decision |
|---|---|
| Type | Dine-in Restaurant |
| Menu Categories | Starters, Main Course, Desserts, Drinks |
| Branches | Sirf 1 outlet |
| Tables | 50+ tables |
| Table Layout | Visual Floor Map — Drag & Drop (owner set karega) |
| Bill Language | English UI |
| WhatsApp Language | Hindi messages |
| Currency | INR ₹ only |
| Bill Header | Restaurant Name + Address + GSTIN (No FSSAI) |

---

## 🔐 2. Login & Roles
| Field | Decision |
|---|---|
| Login Type | Username + Password |
| **Owner** | Full access — Reports, Settings, Menu, Loyalty, Campaigns, User Mgmt |
| **Cashier** | Billing, Customer Register, Checkout, Payment, Coupon Validation |
| **Waiter** | ❌ Does NOT enter orders in system. Sirf KOT dekh sakta hai |

> 💡 Waiter manually order note karta hai. Cashier system mein enter karta hai.

---

## 📋 3. Menu & Items
| Field | Decision |
|---|---|
| Starting Menu | Sample menu pre-loaded + CSV/Excel import feature |
| Variants | **Half / Full** — dono ka price manually alag daalega owner |
| Add-ons | ❌ Nahi chahiye |
| Veg / Non-Veg | ✅ Green dot 🟢 / Red dot 🔴 icon dikhega har item pe |
| Today's Special | ❌ Nahi chahiye |
| Out of Stock | ✅ Owner temporarily mark kar sakta hai |
| Restaurant Logo | Abhi placeholder, baad mein add karna |

---

## 🧾 4. Billing & POS
| Field | Decision |
|---|---|
| GST | CGST 2.5% + SGST 2.5% = **5% Total** |
| Payment Modes | Cash, Card, UPI |
| Payment Details Saved | Sirf amount aur payment mode (no UPI ID / card digits) |
| Discount | Manual % by Cashier |
| Max Discount Limit | ✅ Owner settings mein set karega (e.g. max 20%) |
| Discount Auth | ✅ Agar limit se zyada ho to Owner password maango |
| Bill Number Format | **Prefix + Number** (e.g. RB-0001 — owner prefix set karega) |
| Table System | Running Order (items add hote rahein jab tak bill generate na ho) |
| Order Close | Jab final bill generate ho tab table close hoga |
| Table Transfer | ❌ Nahi chahiye |
| Split Bill | ❌ Nahi chahiye |
| Advance Payment | ❌ Nahi chahiye |

---

## 🔍 5. Order History & Refunds
| Field | Decision |
|---|---|
| Search | Name + Phone + Bill Number — teeno se search |
| Refund / Cancel | ✅ Mandatory reason likhna padega |
| Kaun cancel kar sakta hai | **Unpaid** bill — Cashier khud (galti sudhaarna). **Paid** bill — Owner ka password (paisa wapas jaa raha hai) |
| Cancel ka asar | Points ulta ho jaate hain (mile hue wapas, kharch kiye hue laut aate hain), visit history se bill hat jaata hai, table free ho jaata hai |

---

## 🖨️ 6. Printing
| Field | Decision |
|---|---|
| Bill Printer | Thermal — 58mm / 80mm |
| KOT Printer | Same thermal printer |
| KOT Sections | Ek hi kitchen (no multiple sections) |
| Reports Export | ✅ PDF Download + Print dono |

---

## 🗺️ 7. Table Management
| Field | Decision |
|---|---|
| Table Count | 50+ tables |
| Layout | Visual Floor Map with Drag & Drop setup |
| Table Status | Available (green) / Occupied (red) / Billed (orange) |
| Status Flow | Available → (order khula) Occupied → (bill bana) Billed → (payment liya) Available |

---

## 🎯 8. Loyalty Points System
| Field | Decision |
|---|---|
| Configuration | Fully customizable in Owner Settings |
| Earn Rule | Owner set karega (e.g. ₹100 = 1 point). Poore block par hi — ₹190 = 1 point |
| Redeem Rule | Owner set karega (e.g. 1 point = ₹1) |
| Redemption | Checkout ke time bill mein auto-deduct |
| Redeem Limits | Min points + max % of bill — dono Owner set karega |
| **Tax Order** | Points **GST ke baad** kate hain (tender ki tarah), discount ki tarah pehle nahi — warna GST kam collect hota |
| Points kab milte hain | Payment lene par, bill banne par nahi (cancel hua bill points nahi deta) |
| Ledger | Append-only — har entry me balance-after. Sudhaar nayi entry se hota hai, purani mitti nahi |

---

## 📱 9. WhatsApp Integration
| Field | Decision |
|---|---|
| API Type | **Real Meta WhatsApp Business API** (owner ki key) |
| Keys Status | ⏳ Abhi keys nahi hain → `WHATSAPP_MOCK_MODE=True`. Mock mode me messages simulator par jaate hain, Meta par nahi. Keys aane par Settings me daal ke mode off karna hai. |
| Webhook Note | Meta localhost par callback nahi bhej sakta — replies test karne ke liye ngrok ya deployed HTTPS URL chahiye hoga. |
| Template Sync | Owner Meta pe template approve karaega → System mein "Sync" button se load hoga |
| Screen Simulator | ✅ Phone mockup screen pe dikhega |
| Message Language | **Hindi** |
| Customer Replies | ✅ WhatsApp se aaye replies system mein record honge |

### WhatsApp Configuration Fields (Settings Page):
| Field | Source |
|---|---|
| Phone Number ID | Meta Dashboard → WhatsApp → API Setup |
| WhatsApp Business Account ID (WABA ID) | Meta Dashboard → Business Settings |
| Permanent Access Token | Meta Dashboard → System User → Generate Token |
| App ID | Meta Dashboard → App Dashboard |
| App Secret | Meta Dashboard → Basic Settings |
| Webhook Verify Token | Owner khud set karega (koi bhi word) |
| Webhook URL | System auto-generate karega — Meta pe paste karna hoga |

### 9a. Automated WhatsApp Triggers (Saare 6)
| # | Trigger | Details |
|---|---|---|
| 1 | Welcome Message | Naya customer register hote hi |
| 2 | Bill Receipt | Checkout ke baad invoice summary |
| 3 | Feedback Request | Bill ke baad 1-5 star rating link |
| 4 | Win-back Message | **Owner Settings mein customize** (kitne din baad) |
| 5 | Birthday / Anniversary Offer | DOB/Anniversary **optional** field hai |
| 6 | Broadcast Campaign | Segmented (New / Regular / Inactive) |

### 9b. Campaign & Coupon Rules
| Field | Decision |
|---|---|
| Coupon Code | Auto-generate ya Manual — **dono option** |
| Min Order Amount | ✅ Set kiya ja sakta hai |
| Expiry Date | ✅ Set kiya ja sakta hai |
| Coupon Validation | ✅ Cashier billing ke time code enter karega |
| Used Coupon History | ✅ Track hoga |
| Customer Segments | New / Regular / Inactive — alag alag campaign |

---

## 👤 10. Customer Management
| Field | Decision |
|---|---|
| Registration Fields | Name, Phone, DOB (optional), Anniversary (optional) |
| Phone | Pehchaan phone number hai. "+91 …" / "0…" aap se aap normalize ho jaate hain, taaki ek banda do baar register na ho |
| History | Visit count, total spend (LTV), average bill, points balance |
| Delete | Customer delete nahi hota — deactivate hota hai, warna uske purane bills anaath ho jaate |
| Feedback | 1–5 star + optional comment (WhatsApp link se) |
| Detailed Feedback | ❌ Sirf star + comment (no NPS, no category-wise) |
| Negative Alert | ✅ 1-2 star aane par **owner ko instant screen notification** |
| Search | Name ya Bill Number |

---

## 📊 11. Reports (Owner)
| Report | Format |
|---|---|
| Daily Sales Summary | Screen + PDF + Print |
| Weekly Report | Screen + PDF + Print |
| Monthly Report | Screen + PDF + Print |
| GST Report | Screen + PDF + Print |
| Customer LTV Report | Screen + PDF + Print |

---

## 🎨 12. UI & Design
| Field | Decision |
|---|---|
| Theme | **Light Mode — Clean & Minimal** |
| Device | Laptop + Tablet (Responsive) |
| Data Storage | **Django + SQLite (dev) → Future: PostgreSQL** — localStorage sirf JWT token ke liye |
| Offline Mode | ❌ Nahi chahiye abhi |
| WhatsApp Simulator | ✅ On-screen phone mockup (real-time demo) |

---

## ❌ Features NOT Included (Abhi nahi banane)
- ❌ Inventory / Stock tracking
- ❌ Table Transfer / Merge
- ❌ Split Bill
- ❌ Advance Payment
- ❌ Multiple Branches
- ❌ Email Reports
- ❌ Separate KOT Printer
- ❌ Offline Mode
- ❌ NPS / Category-wise Feedback
- ❌ Today's Special tag
- ❌ FSSAI Number on bill
- ❌ Multi-currency
- ❌ Docker
- ❌ Unit Testing (abhi ke liye)

---

## ✅ Complete Feature Checklist (34 Features)

| # | Feature | ✅ |
|---|---|---|
| 1 | Username + Password Login (Role-Based 3 roles) | ✅ |
| 2 | Dine-in POS — Menu Grid (Half/Full variants) | ✅ |
| 3 | Veg 🟢 / Non-Veg 🔴 Icons on menu | ✅ |
| 4 | Out of Stock toggle on menu items | ✅ |
| 5 | Sample Menu pre-loaded + CSV/Excel Import | ✅ |
| 6 | 50+ Table Visual Floor Map (Drag & Drop setup) | ✅ |
| 7 | Running Order System (items add hote rahein) | ✅ |
| 8 | Cart + GST 5% + Manual Discount % | ✅ |
| 9 | Max Discount Limit (Owner set kare) + Auth if exceeded | ✅ |
| 10 | Bill Number with Custom Prefix (e.g. RB-0001) | ✅ |
| 11 | Cash / Card / UPI Checkout | ✅ |
| 12 | KOT Generation (same thermal printer) | ✅ |
| 13 | Thermal Print-ready Bill (58/80mm) | ✅ |
| 14 | PDF Download + Print for bills & reports | ✅ |
| 15 | Bill Header — Name + Address + GSTIN | ✅ |
| 16 | Customer Registration (Name, Phone, DOB optional) | ✅ |
| 17 | Loyalty Points Engine (Customizable in Settings) | ✅ |
| 18 | Order Cancel with Mandatory Reason | ✅ |
| 19 | Order History Search (Name + Bill No.) | ✅ |
| 20 | WhatsApp Simulator Phone (on screen) | ✅ |
| 21 | Real Meta WhatsApp API — Template Sync from Meta | ✅ |
| 22 | All 6 WhatsApp Automated Triggers (Hindi) | ✅ |
| 23 | WhatsApp Customer Replies tracked in system | ✅ |
| 24 | Coupon Auto-generate ya Manual Code | ✅ |
| 25 | Coupon Min Amount + Expiry Date | ✅ |
| 26 | Coupon Validation at Billing + Used History | ✅ |
| 27 | Customer Segments: New / Regular / Inactive | ✅ |
| 28 | Win-back Days — Customizable in Settings | ✅ |
| 29 | Birthday / Anniversary Offer (optional DOB) | ✅ |
| 30 | 1-5 Star Feedback + Comment (WhatsApp se) | ✅ |
| 31 | Negative Feedback (1-2 star) → Owner Screen Alert | ✅ |
| 32 | Daily / Weekly / Monthly / GST / LTV Reports | ✅ |
| 33 | Light Mode, Responsive (Laptop + Tablet) | ✅ |
| 34 | Django + SQLite backend (PostgreSQL-ready) | ✅ |

---
---

# PART 2 — TECH STACK & ARCHITECTURE

---

## 🏗️ Project Folder Structure

```
rebill/                          ← Root Project Folder
│
├── backend/                     ← Django Project (Python)
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env                     ← Secret keys (WhatsApp API, DB etc.)
│   ├── venv/                    ← Python Virtual Environment
│   ├── config/                  ← Settings, urls, wsgi, asgi
│   └── apps/
│       ├── auth_app/            ← Login, Roles (Owner/Cashier/Waiter)
│       ├── menu/                ← Items, Categories, Half/Full, CSV Import
│       ├── tables/              ← Floor map, Table status
│       ├── billing/             ← Orders, Cart, Bills, KOT, Payments
│       ├── customers/           ← Profiles, Loyalty points, History
│       ├── whatsapp/            ← Meta API, Templates, Campaigns, Replies
│       ├── coupons/             ← Create, Validate, History
│       ├── reports/             ← Daily/Weekly/Monthly/GST/LTV
│       ├── feedback/            ← Ratings, Negative alerts
│       └── settings_app/        ← Restaurant config: bill header, prefix,
│                                  GST rates, discount limit, loyalty, WA keys
│
├── frontend/                    ← React Project (JavaScript)
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── components/          ← Reusable UI components
│       ├── pages/               ← POS, Tables, Customers, Reports, Settings
│       ├── context/             ← React Context API (state management)
│       ├── hooks/               ← Custom React hooks
│       ├── services/            ← Axios API calls to Django
│       └── utils/               ← Helper functions
│
├── README.md                    ← Chalane ka tarika + demo logins
└── PROJECT_REQUIREMENTS.md      ← Yeh file! 📄
```

---

## 🐍 Backend Stack

| Component | Technology |
|---|---|
| Language | Python 3.14 |
| Framework | Django 6.x (Python 3.14 par 4.x/5.x nahi chalte) |
| API Layer | Django REST Framework (DRF) |
| Authentication | JWT — djangorestframework-simplejwt |
| Database (Dev) | SQLite |
| Database (Prod) | PostgreSQL (future migration) |
| Real-Time | Django Channels + WebSockets |
| PDF Generation | ReportLab |
| WhatsApp API | Meta Cloud API (requests library) |
| Scheduled Tasks | django-crontab |
| CSV/Excel Import | pandas + openpyxl |
| CORS | django-cors-headers |
| Environment | python-decouple (.env file) |
| Virtual Env | venv (built-in) |

---

## ⚛️ Frontend Stack

| Component | Technology |
|---|---|
| Framework | React.js (Vite) |
| Language | JavaScript (ES6+) |
| Styling | Tailwind CSS |
| State Management | React Context API + useReducer |
| API Calls | Axios |
| Real-Time | WebSocket (native browser API) |
| Routing | React Router v6 |
| Forms | React Hook Form |
| Charts/Graphs | Recharts |
| PDF Print | react-to-print |
| Table UI | TanStack Table (React Table v8) |
| Package Manager | npm |

---

## 🔐 Authentication Flow

```
1. User → Username + Password enter karta hai (React Login Page)
2. React → POST /api/auth/login/ → Django DRF
3. Django validates → JWT Access Token + Refresh Token return karta hai
4. React tokens localStorage mein save karta hai
5. Har API call mein → Authorization: Bearer <token> header
6. Token expire → Refresh Token se naya Access Token milta hai
7. Role (Owner/Cashier/Waiter) → JWT payload mein embedded
8. React → Role ke hisaab se alag pages/buttons dikhata hai
```

---

## ⚡ Real-Time Flow (Django Channels + WebSockets)

```
Triggers (auto update without page refresh):
  ✅ Naya KOT generate → Kitchen / Cashier screen par instant update
  ✅ Customer 1-2 star deta hai → Owner screen par instant alert notification
  ✅ Naya WhatsApp reply aata hai → Badge update
```

---

## 📱 WhatsApp API Flow

```
1. Owner → Meta pe template approve karata hai
2. Owner → System Settings → "Sync Templates" dabata hai
3. Django → Meta API → Approved templates fetch karta hai
4. Templates campaign/trigger settings mein appear hoti hain
5. Trigger hone par:
   Django → POST Meta Cloud API → Customer ke number par Hindi WhatsApp message
6. Customer reply karta hai → Meta Webhook → Django receive → Database mein save
```

---

## 📅 Scheduled Tasks (django-crontab)

```
Har din subah 10:00 AM:
  → Birthday check → Aaj birthday wale customers → WhatsApp message
  → Anniversary check → Same process

Har din raat 11:00 PM:
  → Win-back check → X days inactive customers → WhatsApp message
  (X = Owner ne Settings mein jo value daali hai)
```

---

## 🔗 API Endpoints Structure

```
/api/auth/           → Login, Logout, Refresh Token, User Management
/api/menu/           → Items CRUD, Categories, Half/Full, CSV Import
/api/tables/         → Floor map, Table status, Running orders
/api/billing/        → Cart, Orders, KOT, Bills, Payments
/api/customers/      → Profiles, Loyalty points, History
/api/whatsapp/       → Templates sync, Campaigns, Replies, Config
/api/coupons/        → Create, Validate, History
/api/reports/        → Daily, Weekly, Monthly, GST, LTV
/api/feedback/       → Ratings, Alerts
/api/settings/       → Bill header, prefix, GST rates, Discount limit,
                       (aage) Loyalty rules, Win-back days, WA keys
```

> ℹ️ Thermal print (bill + KOT) Session 2 me hi ban gaya tha, kyunki bina print
> ke checkout adhoora tha. Session 3 ab Customers + Loyalty + Order History par
> focus karega.

---

## 🛠️ Development Setup Commands

```bash
# ── BACKEND ──────────────────────────────
cd rebill/backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver     # Runs on: localhost:8000

# ── FRONTEND ─────────────────────────────
cd rebill/frontend
npm install
npm run dev                    # Runs on: localhost:3000
```

---

## 📦 Python Packages (requirements.txt)

```
django>=6.0
djangorestframework
djangorestframework-simplejwt
django-cors-headers
channels
daphne
reportlab
pandas
openpyxl
python-decouple
django-crontab
requests
Pillow
```

## 📦 React Packages (package.json)

```
react-router-dom
axios
tailwindcss
react-hook-form
recharts
react-to-print
@tanstack/react-table
```

---

## ⏱️ Time Estimate

| Phase | Features | Time |
|---|---|---|
| 1 | Project Setup (Django + React + JWT + CORS) | ~1-2 hrs |
| 2 | Auth System (Login, 3 Roles) | ~2-3 hrs |
| 3 | Menu Management (CRUD, Half/Full, Veg icons, CSV) | ~3-4 hrs |
| 4 | Table Floor Map (Drag & Drop, Status) | ~4-5 hrs |
| 5 | POS Billing (Cart, GST, Discount, KOT) | ~5-6 hrs |
| 6 | Thermal Print (Bill + PDF) | ~2-3 hrs |
| 7 | Customer + Loyalty Engine | ~3-4 hrs |
| 8 | WhatsApp API + 6 Triggers + Simulator | ~8-10 hrs |
| 9 | Coupons + Campaign Manager + Segments | ~6-8 hrs |
| 10 | Feedback + Negative Alert | ~2-3 hrs |
| 11 | Real-Time WebSockets (Django Channels) | ~3-4 hrs |
| 12 | Scheduled Jobs (Birthday, Win-back) | ~2-3 hrs |
| 13 | Reports (All 5 types + PDF + Print) | ~4-5 hrs |
| 14 | Settings Page (All configs) | ~2-3 hrs |
| 15 | UI Polish + Responsive Design | ~3-4 hrs |
| **TOTAL** | | **~50-65 hrs** |

---

## 📅 Recommended Build Sessions

```
Session 1:  Project Setup + Auth + Menu Management          ✅ DONE
Session 2:  Table Map + POS Billing + KOT + Thermal Print   ✅ DONE
Session 3:  Customer + Loyalty + Order History / Refund     ✅ DONE
Session 4:  WhatsApp API + Simulator + 6 Triggers
Session 5:  Coupons + Campaigns + Feedback
Session 6:  Real-Time + Scheduled Jobs + Reports
Session 7:  Settings + UI Polish + Final Testing
```

---

> 💡 **Note**: Yeh document project ka single source of truth hai.
> Koi bhi feature change karna ho to pehle yahan update karo.
