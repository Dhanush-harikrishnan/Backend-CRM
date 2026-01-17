# Inventory & Billing API - PERN Stack

A production-ready REST API for Inventory & Billing system built with PostgreSQL, Express.js, React (frontend), and Node.js.

## 🚀 Tech Stack

- **Runtime:** Node.js v18+
- **Language:** TypeScript (Strict mode)
- **Framework:** Express.js
- **Database:** PostgreSQL (via Neon.tech)
- **ORM:** Prisma
- **Validation:** Zod
- **Security:** Helmet, CORS, express-rate-limit, JWT
- **Logging:** Winston + Morgan

## 📋 Features

- ✅ **User Authentication** - JWT-based auth with role-based access control
- ✅ **Customer Management** - Regular & Guest customer support
- ✅ **Product Management** - Inventory tracking with low-stock alerts
- ✅ **Invoice Generation** - Atomic transactions with stock deduction
- ✅ **Inventory Logs** - Complete audit trail for stock changes
- ✅ **Security** - Rate limiting, CORS, Helmet, input validation
- ✅ **Error Handling** - Centralized error handling with standardized responses

## 🏗️ Architecture

```
src/
├── config/           # Configuration files (DB, Logger, Env)
├── controllers/      # HTTP request handlers
├── services/         # Business logic layer
├── routes/          # API route definitions
├── middleware/      # Custom middleware (auth, validation, error)
├── validators/      # Zod validation schemas
├── app.ts           # Express app setup
└── server.ts        # Server entry point
```

## 🔧 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://username:password@your-neon-host.neon.tech/dbname?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=5000
FRONTEND_URL="http://localhost:3000"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with initial data
npm run prisma:seed
```

The seed script creates:
- Admin user: `admin@shop.com` / `Admin@123`
- Guest customer (ID: 1)
- Sample products
- Sample customers

### 4. Start Development Server

```bash
npm run dev
```

Server will start at `http://localhost:5000`

### 5. Production Build

```bash
npm run build
npm start
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

All protected endpoints require JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

### 🔐 Auth Endpoints

#### 1. Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "role": "STAFF"  // Optional: ADMIN or STAFF
}
```

#### 2. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@shop.com",
  "password": "Admin@123"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 3. Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

---

### 👥 Customer Endpoints

#### 1. Create Customer
```http
POST /api/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "mobile": "9876543210",
  "email": "rajesh@example.com",
  "address": "123 MG Road, Bangalore",
  "gstNumber": "29ABCDE1234F1Z5"  // Optional
}
```

#### 2. Get All Customers
```http
GET /api/customers?search=Rajesh
Authorization: Bearer <token>
```

#### 3. Get Customer by ID
```http
GET /api/customers/2
Authorization: Bearer <token>
```

#### 4. Update Customer
```http
PUT /api/customers/2
Authorization: Bearer <token>
Content-Type: application/json

{
  "mobile": "9876543211"
}
```

#### 5. Delete Customer
```http
DELETE /api/customers/2
Authorization: Bearer <token>
```

---

### 📦 Product Endpoints

#### 1. Create Product (Admin only)
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Rice (Basmati)",
  "sku": "RICE-BAS-001",
  "description": "1 KG Premium Basmati Rice",
  "price": 120.0,
  "stockQuantity": 100,
  "minStockAlert": 10,
  "category": "Groceries",
  "unit": "KG",
  "taxRate": 5.0
}
```

#### 2. Get All Products
```http
GET /api/products?category=Groceries&isActive=true&search=Rice
Authorization: Bearer <token>
```

#### 3. Get Product by ID
```http
GET /api/products/1
Authorization: Bearer <token>
```

#### 4. Update Product (Admin only)
```http
PUT /api/products/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 125.0,
  "stockQuantity": 150
}
```

#### 5. Update Stock (Admin only)
```http
PATCH /api/products/1/stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 50,          // Positive to add, negative to reduce
  "type": "RESTOCK",       // RESTOCK or ADJUSTMENT
  "notes": "Weekly restock"
}
```

#### 6. Get Low Stock Products
```http
GET /api/products/low-stock
Authorization: Bearer <token>
```

#### 7. Delete Product (Admin only)
```http
DELETE /api/products/1
Authorization: Bearer <token>
```

---

### 🧾 Invoice Endpoints (Critical - Transaction Logic)

#### 1. Create Invoice
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": 1,           // Use 1 for Guest customer
  "items": [
    {
      "productId": 1,
      "quantity": 2
    },
    {
      "productId": 2,
      "quantity": 5
    }
  ],
  "discount": 10.0,          // Optional
  "paymentMode": "CASH",     // CASH, UPI, CARD, CREDIT, NETBANKING
  "paymentStatus": "PAID",   // PAID, PENDING, PARTIAL
  "notes": "Customer requested discount"  // Optional
}

Response:
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "id": 1,
    "invoiceNumber": "INV-20260117-0001",
    "customerId": 1,
    "subtotal": "240.00",
    "taxAmount": "12.00",
    "discount": "10.00",
    "totalAmount": "242.00",
    "paymentMode": "CASH",
    "items": [...],
    "customer": {...}
  }
}
```

**Important Notes:**
- Uses `prisma.$transaction` for atomicity
- Automatically validates stock availability
- Throws error if insufficient stock (rollback)
- Decrements stock quantity for each product
- Creates inventory log entries
- Generates unique invoice number (INV-YYYYMMDD-XXXX)

#### 2. Get All Invoices
```http
GET /api/invoices?startDate=2026-01-01&endDate=2026-01-31&customerId=2&paymentMode=CASH&page=1&limit=20
Authorization: Bearer <token>
```

#### 3. Get Invoice by ID
```http
GET /api/invoices/1
Authorization: Bearer <token>
```

#### 4. Get Sales Summary (Admin only)
```http
GET /api/invoices/summary?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "totalSales": "15240.50",
    "totalInvoices": 23,
    "paymentModeSummary": [
      {
        "paymentMode": "CASH",
        "_sum": { "totalAmount": "8500.00" },
        "_count": 15
      },
      {
        "paymentMode": "UPI",
        "_sum": { "totalAmount": "6740.50" },
        "_count": 8
      }
    ]
  }
}
```

---

## 🔒 Security Features

### 1. **Helmet** - Security Headers
Automatically sets:
- `X-DNS-Prefetch-Control`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`
- etc.

### 2. **CORS** - Cross-Origin Protection
Configured to allow requests only from your frontend URL (`FRONTEND_URL` in `.env`)

### 3. **Rate Limiting**
- General API: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes
- Prevents DDoS and brute force attacks

### 4. **JWT Authentication**
- Secure token-based authentication
- Role-based access control (ADMIN, STAFF)
- Token expiry: 7 days (configurable)

### 5. **Input Validation (Zod)**
All POST/PUT requests are validated with Zod schemas before processing

### 6. **Error Handling**
- No stack traces in production
- Standardized error responses
- Prisma error handling
- JWT error handling

---

## 🎯 Guest Customer Scenario

The system includes a **Guest/Walk-in customer** (ID: 1) for anonymous sales:

### Usage:
```json
{
  "customerId": 1,  // Guest customer
  "items": [...],
  "paymentMode": "CASH"
}
```

### Characteristics:
- Pre-seeded with ID: 1
- Cannot be updated or deleted
- Used for walk-in customers without registration
- Excluded from customer listings

---

## 🚨 Transaction Logic (Invoice Creation)

The invoice creation endpoint implements **ACID transactions** using Prisma:

```typescript
await prisma.$transaction(async (tx) => {
  // Step 1: Validate products & stock
  // Step 2: Calculate totals
  // Step 3: Create invoice
  // Step 4: Create invoice items
  // Step 5: Decrement stock quantities
  // Step 6: Create inventory logs
  
  // If ANY step fails, EVERYTHING is rolled back
});
```

**Critical Business Rules:**
1. ✅ Stock validation before invoice creation
2. ✅ Atomic operations (all-or-nothing)
3. ✅ Automatic stock deduction
4. ✅ Complete audit trail via inventory logs
5. ✅ Historical data preservation (product name/price snapshots)

---

## 📊 Database Schema Highlights

### Key Models:
- **User**: Authentication & authorization
- **Customer**: Regular & guest customers
- **Product**: Inventory with stock tracking
- **Invoice**: Sales records
- **InvoiceItem**: Line items with snapshots
- **InventoryLog**: Complete audit trail

### Important Fields:
- `Product.stockQuantity`: Real-time stock level
- `Product.minStockAlert`: Low stock threshold
- `InvoiceItem.productName`: Historical snapshot (not FK)
- `InventoryLog.quantityChange`: Negative for sales, positive for restock

---

## 🧪 Testing the API

### 1. Health Check
```bash
curl http://localhost:5000/health
```

### 2. Login and Get Token
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shop.com","password":"Admin@123"}'
```

### 3. Create Invoice (Guest Customer)
```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "items": [{"productId": 1, "quantity": 2}],
    "paymentMode": "CASH"
  }'
```

---

## 🐛 Error Handling Examples

### Insufficient Stock
```json
{
  "success": false,
  "message": "Insufficient stock for product \"Rice (Basmati)\". Available: 5, Requested: 10"
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "body.mobile",
      "message": "Invalid Indian mobile number"
    }
  ]
}
```

### Authentication Error
```json
{
  "success": false,
  "message": "Authentication token required"
}
```

---

## 📝 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secret-key` |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `PORT` | Server port | `5000` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

---

## 🚀 Deployment Checklist

- [ ] Update `DATABASE_URL` with production database
- [ ] Generate strong `JWT_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Update `FRONTEND_URL` with production frontend URL
- [ ] Run database migrations
- [ ] Seed production database
- [ ] Configure SSL/TLS
- [ ] Set up monitoring (PM2, Docker, etc.)
- [ ] Configure log rotation
- [ ] Set up backup strategy

---

## 📧 Support

For issues or questions, contact the development team.

---

## 📄 License

ISC
