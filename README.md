# Invoice Management System - Backend API

A comprehensive multi-tenant SaaS invoice management system built with Node.js, Express, TypeScript, and PostgreSQL with Prisma ORM. Similar to Zoho Invoice with GST/tax support for Indian businesses.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone and install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database URL and JWT secret

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# Seed default data (optional)
npx prisma db seed

# Start development server
npm run dev
```

Server runs at `http://localhost:5000`

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/invoice_db"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"

# Stripe Integration (for UPI/Card payments)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 👥 User Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **OWNER** | Organization owner | Full access to everything |
| **ADMIN** | Administrator | Manage users, settings, full CRUD |
| **MANAGER** | Manager | Create/edit invoices, view reports |
| **ACCOUNTANT** | Accountant | Financial reports, payments, expenses |
| **STAFF** | Staff member | Basic invoice and customer operations |

### Role Hierarchy
```
OWNER > ADMIN > MANAGER > ACCOUNTANT > STAFF
```

### Permission Matrix

| Feature | OWNER | ADMIN | MANAGER | ACCOUNTANT | STAFF |
|---------|-------|-------|---------|------------|-------|
| Manage Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Organization Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage Invoices | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Customers | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Products | ✅ | ✅ | ✅ | ❌ | ❌ |
| Record Payments | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage Expenses | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 🔐 Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 📚 API Reference

### Base URL
```
http://localhost:5000/api
```

---

### 🔑 Auth Routes (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/register` | Register new user + organization | Public |
| POST | `/login` | Login user | Public |
| GET | `/profile` | Get current user profile | Private |
| PUT | `/profile` | Update profile (name, phone) | Private |
| POST | `/change-password` | Change password | Private |
| GET | `/users` | Get organization users | OWNER, ADMIN |
| POST | `/invite` | Invite user to organization | OWNER, ADMIN |
| PATCH | `/users/:id/status` | Activate/deactivate user | OWNER, ADMIN |

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "owner@company.com",
  "password": "securePassword123",
  "name": "John Doe",
  "organizationName": "My Company",
  "phone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "clxx...",
      "email": "owner@company.com",
      "name": "John Doe",
      "role": "OWNER"
    },
    "organization": {
      "id": "clxx...",
      "name": "My Company",
      "slug": "my-company"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "owner@company.com",
  "password": "securePassword123"
}
```

#### Invite User
```http
POST /api/auth/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "staff@company.com",
  "name": "Jane Doe",
  "role": "STAFF",
  "password": "tempPassword123"
}
```

---

### 👤 Customer Routes (`/api/customers`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create customer | Private |
| GET | `/` | List customers | Private |
| GET | `/:id` | Get customer by ID | Private |
| PUT | `/:id` | Update customer | Private |
| DELETE | `/:id` | Delete customer | Private |
| GET | `/:id/statement` | Get customer statement | Private |
| GET | `/groups` | List customer groups | Private |
| POST | `/groups` | Create customer group | Private |
| PUT | `/groups/:id` | Update customer group | Private |
| DELETE | `/groups/:id` | Delete customer group | Private |

#### Create Customer
```http
POST /api/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerType": "BUSINESS",
  "displayName": "ABC Corporation",
  "companyName": "ABC Corporation Pvt Ltd",
  "email": "contact@abc.com",
  "phone": "9876543210",
  "gstNumber": "29ABCDE1234F1Z5",
  "billingAddress": {
    "line1": "123 Main Street",
    "city": "Bangalore",
    "state": "Karnataka",
    "postalCode": "560001",
    "country": "India"
  },
  "paymentTerms": 30,
  "creditLimit": 100000
}
```

#### List Customers with Filters
```http
GET /api/customers?search=abc&customerType=BUSINESS&page=1&limit=20&sortBy=displayName&sortOrder=asc
```

---

### 📦 Product Routes (`/api/products`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create product | Private |
| GET | `/` | List products | Private |
| GET | `/:id` | Get product by ID | Private |
| PUT | `/:id` | Update product | Private |
| DELETE | `/:id` | Soft delete product | Private |
| POST | `/:id/adjust-stock` | Adjust inventory | Private |
| GET | `/low-stock` | Get low stock products | Private |
| GET | `/search` | Search products | Private |
| GET | `/categories` | List categories | Private |
| POST | `/categories` | Create category | MANAGER+ |
| PUT | `/categories/:id` | Update category | MANAGER+ |
| DELETE | `/categories/:id` | Delete category | MANAGER+ |

#### Create Product
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Laptop Stand",
  "sku": "LPTS-001",
  "type": "GOODS",
  "description": "Ergonomic aluminum laptop stand",
  "hsnCode": "8473",
  "unit": "PCS",
  "sellingPrice": 2500,
  "costPrice": 1800,
  "taxId": 1,
  "trackInventory": true,
  "stockQuantity": 50,
  "reorderLevel": 10,
  "categoryId": 1
}
```

#### Adjust Stock
```http
POST /api/products/:id/adjust-stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "adjustment": 25,
  "reason": "RESTOCK",
  "notes": "New shipment received"
}
```

**Adjustment Reasons:** `RESTOCK`, `ADJUSTMENT`, `RETURN`, `TRANSFER`

---

### 🧾 Invoice Routes (`/api/invoices`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create invoice | Private |
| GET | `/` | List invoices | Private |
| GET | `/summary` | Get invoice summary | Private |
| GET | `/overdue` | Get overdue invoices | Private |
| GET | `/:id` | Get invoice by ID | Private |
| PUT | `/:id` | Update invoice (draft only) | Private |
| PATCH | `/:id/status` | Update invoice status | Private |
| POST | `/:id/payment` | Record payment | ACCOUNTANT+ |
| POST | `/:id/duplicate` | Duplicate invoice | Private |
| DELETE | `/:id` | Delete invoice | ADMIN+ |

#### Create Invoice
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": 1,
  "invoiceDate": "2026-01-19",
  "dueDate": "2026-02-18",
  "placeOfSupply": "Karnataka",
  "items": [
    {
      "productId": 1,
      "name": "Laptop Stand",
      "quantity": 2,
      "rate": 2500,
      "taxId": 1,
      "discountType": "PERCENTAGE",
      "discountValue": 5
    }
  ],
  "discountType": "FIXED",
  "discountValue": 100,
  "shippingCharge": 50,
  "customerNotes": "Thank you for your business",
  "termsConditions": "Payment due within 30 days",
  "status": "DRAFT"
}
```

**Invoice Response includes:**
- Auto-generated invoice number (e.g., INV-00001)
- GST breakdown (CGST, SGST for intra-state / IGST for inter-state)
- Item-wise tax calculation
- Total amounts

#### Invoice Statuses
| Status | Description |
|--------|-------------|
| `DRAFT` | Editable, not sent |
| `SENT` | Sent to customer |
| `VIEWED` | Customer viewed |
| `PARTIALLY_PAID` | Partial payment received |
| `PAID` | Fully paid |
| `OVERDUE` | Past due date |
| `CANCELLED` | Cancelled |

#### Payment Statuses
| Status | Description |
|--------|-------------|
| `UNPAID` | No payment received |
| `PARTIALLY_PAID` | Partial payment |
| `PAID` | Fully paid |

---

### 💰 Payment Routes (`/api/payments`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Record payment | ACCOUNTANT+ |
| GET | `/` | List payments | Private |
| GET | `/summary` | Get payment summary | ACCOUNTANT+ |
| GET | `/recent` | Get recent payments | Private |
| GET | `/:id` | Get payment by ID | Private |
| PUT | `/:id` | Update payment | ACCOUNTANT+ |
| DELETE | `/:id` | Delete payment | ADMIN+ |
| GET | `/customer/:id` | Get customer payments | Private |
| GET | `/invoice/:id` | Get invoice payments | Private |
| POST | `/:id/apply` | Apply payment to invoices | ACCOUNTANT+ |

#### Record Payment
```http
POST /api/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": 1,
  "invoiceId": 1,
  "amount": 5000,
  "paymentDate": "2026-01-19",
  "paymentMode": "CASH",
  "referenceNumber": "CASH-001",
  "notes": "Full payment received"
}
```

**Payment Modes:** 
- `CASH` - Direct cash payment
- `UPI` - UPI payment via Stripe
- `CARD` - Card payment via Stripe
- `NETBANKING` - Net banking
- `CHEQUE` - Cheque payment
- `BANK_TRANSFER` - Direct bank transfer

> **Note:** UPI and Card payments are processed through Stripe. Use the `/api/stripe/payment-intent` endpoint to initiate online payments.

---

### 📋 Estimate Routes (`/api/estimates`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create estimate | Private |
| GET | `/` | List estimates | Private |
| GET | `/:id` | Get estimate by ID | Private |
| PUT | `/:id` | Update estimate | Private |
| DELETE | `/:id` | Delete estimate | Private |
| PATCH | `/:id/status` | Update status | Private |
| POST | `/:id/convert` | Convert to invoice | Private |
| POST | `/:id/duplicate` | Duplicate estimate | Private |

#### Estimate Statuses
`DRAFT`, `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CONVERTED`

---

### 📝 Credit Note Routes (`/api/credit-notes`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create credit note | ACCOUNTANT+ |
| POST | `/from-invoice/:invoiceId` | Create from invoice | ACCOUNTANT+ |
| GET | `/` | List credit notes | Private |
| GET | `/:id` | Get credit note by ID | Private |
| PUT | `/:id` | Update credit note | ACCOUNTANT+ |
| DELETE | `/:id` | Delete credit note | ADMIN+ |
| PATCH | `/:id/status` | Update status | ACCOUNTANT+ |
| POST | `/:id/apply` | Apply to invoice | ACCOUNTANT+ |
| POST | `/:id/refund` | Record refund | ACCOUNTANT+ |

---

### � Stripe Routes (`/api/stripe`) - UPI & Card Payments

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/config` | Get Stripe publishable key | Private |
| POST | `/payment-intent` | Create payment intent | Private |
| POST | `/confirm` | Confirm payment intent | Private |
| GET | `/payment-intent/:id` | Get payment intent status | Private |
| POST | `/cancel/:paymentIntentId` | Cancel payment | Private |
| POST | `/refund` | Create refund | ACCOUNTANT+ |
| POST | `/webhook` | Stripe webhook handler | Public |
| GET | `/payments` | List Stripe payments | Private |
| GET | `/payments/:id` | Get Stripe payment by ID | Private |
| POST | `/invoice/:invoiceId/pay` | Pay invoice via Stripe | Private |

#### Get Stripe Config
```http
GET /api/stripe/config
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publishableKey": "pk_test_...",
    "isConfigured": true
  }
}
```

#### Create Payment Intent (Card/UPI)
```http
POST /api/stripe/payment-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": 1,
  "invoiceId": 1,
  "amount": 5000,
  "paymentMethodTypes": ["card", "upi"],
  "description": "Payment for Invoice INV-00001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment intent created",
  "data": {
    "paymentIntentId": "pi_xxx",
    "clientSecret": "pi_xxx_secret_xxx",
    "amount": 5000,
    "amountInPaise": 500000,
    "currency": "inr",
    "status": "requires_payment_method",
    "stripePaymentId": 1
  }
}
```

#### Pay Invoice via Stripe
```http
POST /api/stripe/invoice/1/pay
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentMethodTypes": ["card", "upi"]
}
```

#### Create Refund
```http
POST /api/stripe/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentIntentId": "pi_xxx",
  "amount": 1000,
  "reason": "requested_by_customer"
}
```

**Refund Reasons:** `duplicate`, `fraudulent`, `requested_by_customer`

---

### �💸 Expense Routes (`/api/expenses`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create expense | ACCOUNTANT+ |
| GET | `/` | List expenses | ACCOUNTANT+ |
| GET | `/summary` | Get expense summary | ACCOUNTANT+ |
| GET | `/recent` | Get recent expenses | ACCOUNTANT+ |
| GET | `/:id` | Get expense by ID | ACCOUNTANT+ |
| PUT | `/:id` | Update expense | ACCOUNTANT+ |
| DELETE | `/:id` | Delete expense | ADMIN+ |
| GET | `/categories` | List expense categories | ACCOUNTANT+ |
| POST | `/categories` | Create category | ACCOUNTANT+ |
| PUT | `/categories/:id` | Update category | ACCOUNTANT+ |
| DELETE | `/categories/:id` | Delete category | ADMIN+ |

#### Create Expense
```http
POST /api/expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryId": 1,
  "vendorName": "Office Depot",
  "expenseDate": "2026-01-19",
  "amount": 5000,
  "isTaxInclusive": true,
  "taxAmount": 762,
  "paymentMode": "CASH",
  "referenceNumber": "EXP-001",
  "notes": "Office supplies purchase",
  "isBillable": false
}
```

---

### 🏢 Organization Routes (`/api/organization`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get organization details | Private |
| PUT | `/` | Update organization | ADMIN+ |
| PUT | `/settings` | Update settings | ADMIN+ |
| GET | `/taxes` | List taxes | Private |
| POST | `/taxes` | Create tax | ADMIN+ |
| PUT | `/taxes/:id` | Update tax | ADMIN+ |
| DELETE | `/taxes/:id` | Delete tax | ADMIN+ |
| GET | `/bank-accounts` | List bank accounts | Private |
| POST | `/bank-accounts` | Create bank account | ADMIN+ |
| PUT | `/bank-accounts/:id` | Update bank account | ADMIN+ |
| DELETE | `/bank-accounts/:id` | Delete bank account | ADMIN+ |

#### Create Tax
```http
POST /api/organization/taxes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "GST 18%",
  "rate": 18,
  "type": "GST",
  "cgstRate": 9,
  "sgstRate": 9,
  "igstRate": 18,
  "cessRate": 0,
  "isDefault": true
}
```

---

### 📊 Report Routes (`/api/reports`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/dashboard` | Dashboard overview | Private |
| GET | `/sales` | Sales report | MANAGER+ |
| GET | `/tax` | Tax report (GST summary) | ACCOUNTANT+ |
| GET | `/receivables-aging` | Aging report | ACCOUNTANT+ |
| GET | `/customer-statement/:id` | Customer statement | Private |
| GET | `/expense` | Expense report | ACCOUNTANT+ |
| GET | `/profit-loss` | Profit & Loss summary | ACCOUNTANT+ |
| GET | `/product-sales` | Product sales report | Private |

#### Dashboard Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSales": 500000,
      "totalReceived": 400000,
      "totalOutstanding": 100000,
      "overdueAmount": 25000,
      "totalExpenses": 150000
    },
    "invoiceCounts": {
      "draft": 5,
      "sent": 10,
      "paid": 50,
      "overdue": 3
    },
    "recentInvoices": [...],
    "recentPayments": [...],
    "topCustomers": [...],
    "monthlySales": [...]
  }
}
```

---

## 🗄️ Database Schema Overview

### Core Models

| Model | Description |
|-------|-------------|
| `Organization` | Multi-tenant organization (company) |
| `User` | Organization members with roles |
| `Customer` | Customer/client records |
| `CustomerGroup` | Customer grouping/categorization |
| `Product` | Products and services |
| `ProductCategory` | Product categorization |
| `Invoice` | Sales invoices |
| `InvoiceItem` | Invoice line items |
| `Estimate` | Quotations/estimates |
| `CreditNote` | Credit notes/refunds |
| `Payment` | Payment records |
| `PaymentApplication` | Payment to invoice mapping |
| `Expense` | Business expenses |
| `ExpenseCategory` | Expense categorization |
| `Tax` | Tax configurations (GST) |
| `BankAccount` | Bank account details |
| `InventoryLog` | Stock movement tracking |
| `ActivityLog` | Audit trail |

---

## 🧮 GST Calculation Logic

### Intra-State (Same State)
- CGST = 50% of total GST rate
- SGST = 50% of total GST rate
- IGST = 0

### Inter-State (Different States)
- CGST = 0
- SGST = 0
- IGST = Full GST rate

### Example: 18% GST on ₹10,000
**Intra-State:**
- Taxable: ₹10,000
- CGST (9%): ₹900
- SGST (9%): ₹900
- Total: ₹11,800

**Inter-State:**
- Taxable: ₹10,000
- IGST (18%): ₹1,800
- Total: ₹11,800

---

## 📁 Project Structure

```
src/
├── config/           # Configuration files
│   ├── index.ts      # Main config
│   ├── database.ts   # Prisma client
│   └── logger.ts     # Winston logger
├── controllers/      # Request handlers
├── middleware/       # Express middleware
│   ├── auth.middleware.ts      # JWT auth & roles
│   ├── error.middleware.ts     # Error handling
│   └── validation.middleware.ts # Zod validation
├── routes/           # API routes
├── services/         # Business logic
├── validators/       # Zod schemas
├── app.ts           # Express app setup
└── server.ts        # Server entry point
prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Seed data
```

---

## 🔧 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript check
```

---

## 🛡️ Security Features

- **JWT Authentication** with configurable expiry
- **Role-Based Access Control (RBAC)**
- **Multi-Tenant Data Isolation** - Users can only access their organization's data
- **Rate Limiting** on auth endpoints (5 requests/15 min)
- **Input Validation** with Zod schemas
- **SQL Injection Protection** via Prisma ORM
- **Password Hashing** with bcrypt (12 rounds)

---

## 📝 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `DUPLICATE_ENTRY` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Environment for Production
```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
JWT_SECRET="strong-random-secret"
```

---

## 📄 License

MIT License

---

## 🤝 Support

For issues and feature requests, please create an issue in the repository.
