# 🏗️ Project Structure

```
Invoice/
│
├── 📁 prisma/
│   ├── schema.prisma          # Database schema definition
│   └── seed.ts                # Database seeding script
│
├── 📁 src/
│   │
│   ├── 📁 config/
│   │   ├── index.ts           # Environment configuration
│   │   ├── logger.ts          # Winston logger setup
│   │   └── database.ts        # Prisma client instance
│   │
│   ├── 📁 middleware/
│   │   ├── auth.middleware.ts      # JWT authentication & authorization
│   │   ├── error.middleware.ts     # Error handling & async wrapper
│   │   └── validation.middleware.ts # Zod validation middleware
│   │
│   ├── 📁 validators/
│   │   └── index.ts           # Zod schemas for input validation
│   │
│   ├── 📁 services/           # Business logic layer
│   │   ├── auth.service.ts    # Authentication logic
│   │   ├── customer.service.ts # Customer CRUD operations
│   │   ├── product.service.ts  # Product & stock management
│   │   └── invoice.service.ts  # Invoice creation with transactions ⭐
│   │
│   ├── 📁 controllers/        # HTTP request handlers
│   │   ├── auth.controller.ts
│   │   ├── customer.controller.ts
│   │   ├── product.controller.ts
│   │   └── invoice.controller.ts
│   │
│   ├── 📁 routes/             # API route definitions
│   │   ├── auth.routes.ts     # POST /api/auth/login, /register
│   │   ├── customer.routes.ts # GET/POST/PUT/DELETE /api/customers
│   │   ├── product.routes.ts  # GET/POST/PUT/DELETE /api/products
│   │   └── invoice.routes.ts  # POST /api/invoices, GET /api/invoices
│   │
│   ├── app.ts                 # Express app configuration ⭐
│   └── server.ts              # Server entry point
│
├── 📁 logs/                   # Winston log files (auto-generated)
│   ├── combined.log
│   ├── error.log
│   └── exceptions.log
│
├── 📁 dist/                   # Compiled JavaScript (after build)
│
├── 📄 .env                    # Environment variables (not in git)
├── 📄 .env.example            # Environment template
├── 📄 .gitignore
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 README.md               # Main documentation ⭐
├── 📄 TRANSACTION_LOGIC.md    # Transaction explanation ⭐
└── 📄 SETUP_GUIDE.md          # Setup instructions ⭐
```

---

## 📋 File Descriptions

### Configuration Layer

#### `src/config/index.ts`
- Loads and validates environment variables
- Exports typed configuration object
- Throws errors for missing critical vars in production

#### `src/config/logger.ts`
- Winston logger configuration
- Different log levels for dev/prod
- File rotation for error/combined logs

#### `src/config/database.ts`
- Prisma Client singleton instance
- Query logging in development
- Error/warning event handlers

---

### Middleware Layer

#### `src/middleware/auth.middleware.ts`
- `authenticate()`: Verifies JWT token from Authorization header
- `authorize(...roles)`: Role-based access control
- Attaches `req.user` with decoded token data

#### `src/middleware/error.middleware.ts`
- `AppError` class: Custom error with status code
- `errorHandler()`: Centralized error handling
- `notFoundHandler()`: 404 handler
- `asyncHandler()`: Wraps async controllers to catch errors

#### `src/middleware/validation.middleware.ts`
- `validate(schema)`: Zod validation middleware factory
- Validates req.body, req.query, req.params
- Returns formatted error messages

---

### Validation Layer

#### `src/validators/index.ts`
All Zod schemas for input validation:
- Auth: `loginSchema`, `registerSchema`
- Customer: `createCustomerSchema`, `updateCustomerSchema`
- Product: `createProductSchema`, `updateProductSchema`, `updateStockSchema`
- Invoice: `createInvoiceSchema`, `getInvoiceByIdSchema`

---

### Service Layer (Business Logic)

#### `src/services/auth.service.ts`
- `register()`: Create user with bcrypt password hash
- `login()`: Verify credentials, return JWT token
- `getProfile()`: Fetch user details

#### `src/services/customer.service.ts`
- `createCustomer()`: Add new customer (check duplicates)
- `getAllCustomers()`: List all (exclude guest)
- `getCustomerById()`: Get with purchase history
- `updateCustomer()`: Update details
- `deleteCustomer()`: Remove (if no invoices)

#### `src/services/product.service.ts`
- `createProduct()`: Add new product (check SKU)
- `getAllProducts()`: List with filters
- `getProductById()`: Get with inventory logs
- `updateProduct()`: Modify details
- `updateStock()`: Restock/adjustment with transaction
- `getLowStockProducts()`: Products below minStockAlert

#### `src/services/invoice.service.ts` ⭐ CRITICAL
- `createInvoice()`: **Transaction-based invoice creation**
  - Validates stock availability
  - Creates invoice + items
  - Decrements stock atomically
  - Creates audit logs
  - Rolls back on any error
- `getInvoiceById()`: Fetch with customer + items
- `getInvoices()`: List with filters + pagination
- `getSalesSummary()`: Aggregate sales data

---

### Controller Layer (HTTP Handlers)

Each controller handles HTTP requests/responses:
- Extracts data from req.body/params/query
- Calls appropriate service method
- Returns JSON response with standard format:
  ```json
  {
    "success": true,
    "message": "...",
    "data": {...}
  }
  ```

---

### Route Layer (API Endpoints)

#### `src/routes/auth.routes.ts`
```
POST   /api/auth/register    # Create user (rate limited)
POST   /api/auth/login       # Login (rate limited)
GET    /api/auth/profile     # Get current user (protected)
```

#### `src/routes/customer.routes.ts`
```
POST   /api/customers        # Create customer (protected)
GET    /api/customers        # List customers (protected)
GET    /api/customers/:id    # Get customer (protected)
PUT    /api/customers/:id    # Update customer (protected)
DELETE /api/customers/:id    # Delete customer (admin only)
```

#### `src/routes/product.routes.ts`
```
POST   /api/products              # Create product (admin only)
GET    /api/products              # List products (protected)
GET    /api/products/low-stock    # Low stock alert (protected)
GET    /api/products/:id          # Get product (protected)
PUT    /api/products/:id          # Update product (admin only)
PATCH  /api/products/:id/stock    # Update stock (admin only)
DELETE /api/products/:id          # Delete product (admin only)
```

#### `src/routes/invoice.routes.ts`
```
POST   /api/invoices          # Create invoice (protected) ⭐
GET    /api/invoices          # List invoices (protected)
GET    /api/invoices/summary  # Sales summary (admin only)
GET    /api/invoices/:id      # Get invoice (protected)
```

---

### Entry Points

#### `src/app.ts` ⭐
Express application setup:
1. Security middleware (Helmet, CORS, Rate Limiting)
2. Body parsing
3. Logging (Morgan)
4. Route mounting
5. Error handling

#### `src/server.ts`
Server lifecycle management:
- Start HTTP server
- Graceful shutdown (SIGTERM, SIGINT)
- Database disconnect
- Uncaught exception handling

---

## 🔄 Request Flow

### Example: Creating an Invoice

```
1. Client Request
   └─→ POST /api/invoices + JWT token
       Body: { customerId: 1, items: [...], paymentMode: "CASH" }

2. Express Middleware Chain
   ├─→ Helmet (security headers)
   ├─→ CORS (origin check)
   ├─→ Rate Limiter (check request count)
   ├─→ Body Parser (parse JSON)
   └─→ Morgan (log request)

3. Route Handler (invoice.routes.ts)
   ├─→ authenticate() middleware
   │   └─→ Verify JWT token
   │   └─→ Attach req.user
   └─→ validate(createInvoiceSchema) middleware
       └─→ Validate req.body with Zod

4. Controller (invoice.controller.ts)
   └─→ invoiceController.createInvoice()
       └─→ Extract data from req.body
       └─→ Call service method

5. Service (invoice.service.ts) ⭐
   └─→ invoiceService.createInvoice()
       └─→ prisma.$transaction(async (tx) => {
             • Fetch products
             • Validate stock
             • Create invoice
             • Create items
             • Decrement stock
             • Create logs
           })

6. Database (PostgreSQL via Prisma)
   └─→ Execute transaction
   └─→ Commit or Rollback

7. Response Chain
   ├─→ Service returns invoice data
   ├─→ Controller formats JSON response
   └─→ Express sends to client

8. Error Handling (if any error)
   └─→ errorHandler() middleware
       └─→ Format error response
       └─→ Log error
       └─→ Send JSON error
```

---

## 🎯 Architecture Patterns

### 1. Layered Architecture
```
Routes → Controllers → Services → Database
   ↓         ↓            ↓          ↓
 HTTP    Validation   Business   Prisma ORM
Handling             Logic
```

### 2. Dependency Injection
```typescript
// Service as singleton
export default new InvoiceService();

// Controller imports service
import invoiceService from '../services/invoice.service';
```

### 3. Middleware Chain
```typescript
router.post(
  '/',
  authenticate,              // 1. Check auth
  validate(createInvoice),   // 2. Validate input
  controller.createInvoice   // 3. Handle request
);
```

### 4. Error Handling Pattern
```typescript
// Async wrapper (no try-catch needed in controllers)
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
createInvoice = asyncHandler(async (req, res) => {
  const invoice = await service.createInvoice(req.body);
  res.json({ success: true, data: invoice });
});
```

---

## 📊 Database Schema Overview

```
┌─────────────┐
│    Users    │  (Authentication)
└─────────────┘

┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│  Customers  │──────→│   Invoices   │──────→│ InvoiceItems │
└─────────────┘       └──────────────┘       └──────────────┘
                             │                        │
                             └────────────────────────┘
                                        ↓
                                  ┌──────────┐
                                  │ Products │
                                  └──────────┘
                                        ↓
                                ┌──────────────┐
                                │InventoryLogs │  (Audit Trail)
                                └──────────────┘
```

### Relationships:
- Customer `1:N` Invoice (one customer, many invoices)
- Invoice `1:N` InvoiceItem (one invoice, many line items)
- Product `1:N` InvoiceItem (one product, many sales)
- Product `1:N` InventoryLog (one product, many stock changes)

---

## 🔒 Security Layers

```
1. Network Layer
   └─→ Helmet (security headers)
   └─→ CORS (origin whitelist)
   └─→ Rate Limiting (DDoS protection)

2. Authentication Layer
   └─→ JWT tokens
   └─→ Bcrypt password hashing

3. Authorization Layer
   └─→ Role-based access (ADMIN/STAFF)
   └─→ Protected routes

4. Validation Layer
   └─→ Zod input validation
   └─→ Type safety (TypeScript)

5. Database Layer
   └─→ Prisma (SQL injection prevention)
   └─→ Transactions (data integrity)

6. Error Layer
   └─→ No stack traces in production
   └─→ Sanitized error messages
```

---

## 📝 Key Files to Understand

### Must Read (Priority 1):
1. ✅ `prisma/schema.prisma` - Database structure
2. ✅ `src/app.ts` - Express setup with security
3. ✅ `src/services/invoice.service.ts` - Transaction logic
4. ✅ `src/middleware/error.middleware.ts` - Error handling

### Important (Priority 2):
5. ✅ `src/validators/index.ts` - Input validation
6. ✅ `src/middleware/auth.middleware.ts` - JWT auth
7. ✅ `src/config/index.ts` - Environment config

### Good to Know (Priority 3):
8. Other services and controllers
9. Route definitions
10. Logger and database config

---

This structure follows **SOLID principles** and **separation of concerns**, making the codebase maintainable and scalable.
