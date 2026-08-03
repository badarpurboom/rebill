# 🍽️ ReBill

Restaurant Billing & WhatsApp Engagement System — Django REST backend + React (Vite) frontend.

Full requirements: [PROJECT_REQUIREMENTS.md](PROJECT_REQUIREMENTS.md)

---

## Chalane ka tarika

Do terminal chahiye — ek backend ke liye, ek frontend ke liye.

### Terminal 1 — Backend (Django, port 8000)

```powershell
cd backend
.\venv\Scripts\activate
python manage.py runserver
```

### Terminal 2 — Frontend (React, port 3000)

```powershell
cd frontend
npm run dev
```

Browser me kholo: **http://localhost:3000**

> Vite `localhost` par bind hota hai. `127.0.0.1:3000` kaam nahi karega — `localhost:3000` hi use karo.

---

## Demo logins

| Role | Username | Password | Login ke baad kahan jaata hai |
|---|---|---|---|
| Owner | `owner` | `owner123` | Dashboard — sab kuch |
| Cashier | `cashier` | `cashier123` | Billing / POS |
| Waiter | `waiter` | `waiter123` | KOT screen |

Login page par teeno ke demo buttons hain — click karo, form apne aap bhar jaayega.

Owner Django admin bhi khol sakta hai: http://127.0.0.1:8000/admin/

---

## Pehli baar setup (agar naye machine par ho)

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py seed_demo      # 3 demo users + 25 sample menu items

python manage.py seed_tables         # 50 tables + settings row
python manage.py seed_customers      # 6 demo customers

# Frontend
cd ..\frontend
npm install
```

Teeno seed commands dobara chalana safe hai — duplicate nahi banenge, aur badla hua password reset nahi hoga.

---

## Abhi kya ban chuka hai

### Session 1 — Auth + Menu
- ✅ JWT login, 3 roles (Owner / Cashier / Waiter), auto token refresh
- ✅ Role-based navigation + route guards (server par bhi enforce hota hai)
- ✅ Menu: categories, items, Half/Full pricing, Veg 🟢 / Non-Veg 🔴, out-of-stock toggle
- ✅ CSV / Excel menu import (upsert — dobara import karne par duplicate nahi)
- ✅ Sample menu 25 items pre-loaded

### Session 2 — Tables + POS + KOT
- ✅ 50 tables ka visual floor map, Owner drag & drop se layout set karta hai
- ✅ Status colors: Available 🟢 / Occupied 🔴 / Billed 🟠 — 15 sec me auto refresh
- ✅ Running order — bill banne tak items add hote rehte hain, table tab tak occupied
- ✅ POS: menu grid me Half/Full ek-ek tap, cart me qty +/−, live totals
- ✅ GST 5% (CGST 2.5 + SGST 2.5) — saara hisaab server par, ek hi jagah
- ✅ Manual discount %, limit cross ho to Owner ka password (bill par likha jaata hai)
- ✅ Bill number RB-0001 — counter row-locked, do cashier ek hi number nahi le sakte
- ✅ Cash / Card / UPI checkout (sirf amount + mode save hota hai)
- ✅ KOT — har baar sirf naye items jaate hain, purane dobara nahi
- ✅ Thermal print preview 58mm / 80mm — KOT aur bill dono
- ✅ Settings page — bill header, prefix, GST rates, max discount

### Session 3 — Customers + Loyalty + Order History
- ✅ Customer register — naam, phone, DOB & anniversary (optional). Phone hi pehchaan hai
- ✅ Phone "+91 98765 43210" ho ya "098765 43210" — ek hi customer banta hai
- ✅ Visit count, total spend (LTV), average bill, points balance
- ✅ Loyalty engine — earn/redeem rules Settings me customizable
- ✅ POS me customer jodo, checkout par points redeem karo
- ✅ Points ledger — append-only, har entry me balance-after (audit ke liye)
- ✅ Owner manually points adjust kar sakta hai (wajah zaroori)
- ✅ Order History — bill number, customer naam ya phone se search + status/mode filter
- ✅ Bill reprint kisi bhi purane bill ka
- ✅ Cancel / Refund — wajah mandatory, paid bill ke liye Owner password, points wapas

Baaki pages abhi placeholder hain — routes aur guards already live hain.

---

## Loyalty points kaise kaam karte hain

```
Kamai:   ₹100 kharch = 1 point   (Settings me badal sakte ho)
         Poore block par hi — ₹190 par bhi 1 hi point
         Points payment ke waqt milte hain, bill banne par nahi

Kharcha: 1 point = ₹1            (Settings me badal sakte ho)
         Min 50 points, aur ek bill me max 50% tak
```

**Zaroori baat:** points GST ke **baad** kate hain, discount ki tarah pehle nahi.
Agar points ko discount maana jaata to GST kam collect hota — jo galat hai.

```
Sub Total        760.00
CGST 2.5%         19.00
SGST 2.5%         19.00
Total            798.00     ← GST invoice ki value
Points (161)    -161.00     ← yahan kata, tax ke baad
Dena hai         637.00
```

Bill cancel karne par sab kuch ulta ho jaata hai — mile hue points wapas le liye jaate hain,
kharch kiye hue points laut aate hain, aur visit history se bill hat jaata hai.

---

## Aage ka plan

| Session | Kya banega |
|---|---|
| ~~2~~ | ~~Table floor map + POS billing + KOT~~ ✅ |
| ~~3~~ | ~~Customers + Loyalty + Order history/refund~~ ✅ |
| 4 | WhatsApp API + Simulator + 6 triggers |
| 5 | Coupons + Campaigns + Feedback |
| 6 | Real-time (Channels) + Scheduled jobs + Reports |
| 7 | UI polish + user management + final testing |

---

## Tech notes

- **Django 6.0** (requirements doc me 4.x likha tha) — is machine par Python 3.14 hai, aur Django 4.x/5.x Python 3.14 support nahi karte. API same hai.
- **Database**: dev me SQLite (`backend/db.sqlite3`). Prod me PostgreSQL — `config/settings.py` me `DATABASES` badalna hoga.
- **WhatsApp**: abhi `WHATSAPP_MOCK_MODE=True` (`.env` me). Meta credentials milne par Settings page me daal ke `False` kar dena.
- **CORS/Proxy**: Vite `/api` ko Django par proxy karta hai, isliye browser same-origin rehta hai. `django-cors-headers` bhi configured hai agar aage alag origin se chalana ho.
- **Real-time**: Channels + Daphne install hain, ASGI configured hai. Consumers Session 6 me aayenge.

---

## Ek order kaise chalta hai

```
Table (green)
  → cashier click karta hai        → Order khulta hai, table RED (occupied)
  → "Customer jodo" (optional)     → phone se dhoondo ya naya register karo
  → items add hote rehte hain      → running order
  → "KOT bhejo"                    → sirf naye items ka ticket kitchen jaata hai
  → aur items add                  → agla KOT bhi sirf naye items lega
  → discount + points redeem       → limit se zyada discount ho to Owner password
  → "Bill banao"                   → RB-0001 ban jaata hai, table ORANGE (billed)
  → Cash / Card / UPI              → paid, points milte hain, table wapas GREEN
```

Bill ban jaane ke baad us order me items add/remove nahi ho sakte — server mana kar deta hai.
Agar bill bana ke bina payment liye chale gaye, to us table par dobara jaate hi
payment screen wapas khul jaayegi.

---

## Menu CSV format

```
category, name, food_type, half_price, full_price, description
```

`category`, `name`, `full_price` zaroori hain — baaki optional.
`food_type` me `Veg` / `Non-Veg` chalega (khaali chhoda to Veg maan liya jaayega).
Menu page → **CSV Import** → *Sample template download karo* se ready-made file mil jaayegi.
