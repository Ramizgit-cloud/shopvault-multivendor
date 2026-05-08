# 🛒 ShopVault — Multi-Vendor E-Commerce System

A complete, production-ready multi-vendor marketplace built with:
- **Frontend**: React.js + React Router + Context API
- **Backend**: Node.js + Express.js
- **Database**: MySQL + Sequelize ORM
- **Payment**: Razorpay Integration
- **Auth**: JWT + bcrypt + Role-Based Access Control

---

## 📁 Project Structure

```
shopvault/
├── backend/
│   ├── config/         # Database config (Sequelize + MySQL)
│   ├── controllers/    # Business logic (auth, products, orders, payment, reviews, admin)
│   ├── middleware/     # JWT auth, role checks, error handler
│   ├── models/         # Sequelize models (User, Product, Order, OrderItem, Review)
│   ├── routes/         # Express route definitions
│   ├── utils/          # JWT helpers
│   ├── app.js          # Express app setup
│   └── server.js       # Server entry (DB sync + seed admin)
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/ # Navbar, ProductCard, Footer, ProtectedRoute
│       ├── context/    # AuthContext, CartContext
│       ├── pages/      # Home, Login, Register, ProductDetail, Cart, Orders, VendorDashboard, AdminDashboard, Profile
│       └── services/   # Axios API service (api.js)
└── README.md
```

---

## ⚙️ Prerequisites

- Node.js v18+
- MySQL 8.0+
- npm or yarn

---

## 🚀 Setup Instructions

### 1. Create MySQL Database

Open MySQL and run:
```sql
CREATE DATABASE multivendor_db;
```

### 2. Configure Backend Environment

Edit `backend/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword        ← change this
DB_NAME=multivendor_db
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
NODE_ENV=development
```

### 3. Configure Frontend Environment

Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_RAZORPAY_KEY_ID=your_razorpay_key_id
```

### 4. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Start the Servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
Server starts at: http://localhost:5000

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
```
App opens at: http://localhost:3000

---

## 🔐 Default Admin Account

On first startup, an admin account is auto-created:

| Field | Value |
|-------|-------|
| Email | admin@shop.com |
| Password | Admin@123 |
| Role | admin |

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Admin** | Full control — manage users, vendors, products, orders, dashboard analytics |
| **Vendor** | Add/edit/delete own products, view orders for own products, update order status, see earnings |
| **Customer** | Browse products, cart, checkout with Razorpay, order tracking, write reviews |

---

## 💳 Razorpay Setup

1. Create a free account at [razorpay.com](https://razorpay.com)
2. Go to **Settings → API Keys → Generate Test Key**
3. Copy **Key ID** and **Key Secret** into:
   - `backend/.env` → `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
   - `frontend/.env` → `REACT_APP_RAZORPAY_KEY_ID`

> In test mode, use Razorpay test card: `4111 1111 1111 1111`, any future expiry, any CVV.

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Auth |
| PUT | /api/auth/profile | Auth |
| PUT | /api/auth/change-password | Auth |

### Products
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | /api/products | Public |
| GET | /api/products/:id | Public |
| GET | /api/products/categories | Public |
| GET | /api/products/vendor/my-products | Vendor |
| POST | /api/products | Vendor/Admin |
| PUT | /api/products/:id | Vendor/Admin |
| DELETE | /api/products/:id | Vendor/Admin |

### Orders
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/orders | Customer |
| GET | /api/orders/my | Customer |
| GET | /api/orders/vendor/orders | Vendor |
| GET | /api/orders/vendor/earnings | Vendor |
| GET | /api/orders/all | Admin |
| PUT | /api/orders/:id/status | Vendor/Admin |

### Payment
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/payment/create-order | Customer |
| POST | /api/payment/verify | Customer |

### Reviews
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/reviews | Customer |
| GET | /api/reviews/product/:id | Public |
| DELETE | /api/reviews/:id | Customer/Admin |

### Admin
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | /api/admin/dashboard | Admin |
| GET | /api/admin/users | Admin |
| PUT | /api/admin/users/:id/toggle-status | Admin |
| PUT | /api/admin/vendors/:id/approve | Admin |
| GET | /api/admin/products | Admin |
| DELETE | /api/admin/products/:id | Admin |

---

## 🗄️ Database Schema

```
users          → id, name, email, password, role, isActive, isApproved, phone, address
products       → id, name, description, price, stock, category, image, vendor_id (FK), discount, isActive
orders         → id, user_id (FK), total_price, status, payment_status, payment_id, razorpay_order_id
order_items    → id, order_id (FK), product_id (FK), vendor_id (FK), quantity, price
reviews        → id, user_id (FK), product_id (FK), rating, comment
```

---

## 🔒 Security Features

- Passwords hashed with **bcrypt** (12 salt rounds)
- **JWT** tokens with expiry
- **Role-Based Access Control** on all protected routes
- Vendor accounts require **admin approval** before listing products
- Payment signature **HMAC-SHA256 verification** via Razorpay
- SQL injection protection via **Sequelize ORM parameterized queries**
- CORS configured for frontend origin only

---

## ✨ Features Summary

**Customer:**
- Browse & search products with filters (category, price range, search)
- Product detail page with reviews and ratings
- Shopping cart (persisted in localStorage)
- Razorpay checkout with payment verification
- Order history with status tracking

**Vendor:**
- Product management (CRUD)
- View orders containing their products
- Update order status (pending → shipped → delivered)
- Earnings dashboard (total revenue, orders, items sold)

**Admin:**
- Analytics dashboard (users, vendors, products, orders, revenue)
- Approve/block vendors
- Block/unblock customers
- Remove products
- View all orders

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Axios, React Toastify |
| Backend | Node.js, Express.js |
| Database | MySQL 8 + Sequelize 6 ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Payment | Razorpay Node SDK |
| Styling | Custom CSS with CSS Variables (no framework) |

---

*Built with ❤️ — ShopVault Multi-Vendor Platform*
