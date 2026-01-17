# 📡 API Examples - Full Request/Response Documentation

## 🔗 Base URL
```
http://localhost:5000/api
```

## 🔐 Authentication

All protected endpoints require JWT token:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 1️⃣ AUTHENTICATION ENDPOINTS

### 1.1 Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "staff@shop.com",
  "password": "StaffPass123",
  "name": "Staff Member",
  "role": "STAFF"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "clr1234abcd",
      "email": "staff@shop.com",
      "name": "Staff Member",
      "role": "STAFF"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHIxMjM0YWJjZCIsImVtYWlsIjoic3RhZmZAc2hvcC5jb20iLCJyb2xlIjoiU1RBRkYiLCJpYXQiOjE3MDU0ODIwMDAsImV4cCI6MTcwNjA4NjgwMH0.abc123xyz"
  }
}
```

---

### 1.2 Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@shop.com",
  "password": "Admin@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "clr9876wxyz",
      "email": "admin@shop.com",
      "name": "Shop Admin",
      "role": "ADMIN"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### 1.3 Get Profile
```http
GET /api/auth/profile
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clr9876wxyz",
    "email": "admin@shop.com",
    "name": "Shop Admin",
    "role": "ADMIN",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

---

## 2️⃣ CUSTOMER ENDPOINTS

### 2.1 Create Customer
```http
POST /api/customers
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Priya Sharma",
  "mobile": "9876543210",
  "email": "priya@example.com",
  "address": "456 MG Road, Bangalore, Karnataka 560001",
  "gstNumber": "29ABCDE1234F1Z5"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "id": 2,
    "name": "Priya Sharma",
    "mobile": "9876543210",
    "email": "priya@example.com",
    "address": "456 MG Road, Bangalore, Karnataka 560001",
    "gstNumber": "29ABCDE1234F1Z5",
    "isGuest": false,
    "createdAt": "2026-01-17T12:00:00.000Z",
    "updatedAt": "2026-01-17T12:00:00.000Z"
  }
}
```

**Validation Error (400):**
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

---

### 2.2 Get All Customers
```http
GET /api/customers?search=Priya
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 2,
      "name": "Priya Sharma",
      "mobile": "9876543210",
      "email": "priya@example.com",
      "address": "456 MG Road, Bangalore, Karnataka 560001",
      "gstNumber": "29ABCDE1234F1Z5",
      "isGuest": false,
      "createdAt": "2026-01-17T12:00:00.000Z",
      "updatedAt": "2026-01-17T12:00:00.000Z"
    },
    {
      "id": 3,
      "name": "Rajesh Kumar",
      "mobile": "9876543211",
      "email": "rajesh@example.com",
      "address": "123 Main St, Delhi",
      "gstNumber": null,
      "isGuest": false,
      "createdAt": "2026-01-16T10:00:00.000Z",
      "updatedAt": "2026-01-16T10:00:00.000Z"
    }
  ]
}
```

---

### 2.3 Get Customer by ID
```http
GET /api/customers/2
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Priya Sharma",
    "mobile": "9876543210",
    "email": "priya@example.com",
    "address": "456 MG Road, Bangalore, Karnataka 560001",
    "gstNumber": "29ABCDE1234F1Z5",
    "isGuest": false,
    "createdAt": "2026-01-17T12:00:00.000Z",
    "updatedAt": "2026-01-17T12:00:00.000Z",
    "invoices": [
      {
        "id": 5,
        "invoiceNumber": "INV-20260117-0003",
        "totalAmount": "1250.00",
        "paymentMode": "UPI",
        "createdAt": "2026-01-17T14:30:00.000Z"
      }
    ],
    "_count": {
      "invoices": 1
    }
  }
}
```

---

### 2.4 Update Customer
```http
PUT /api/customers/2
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "mobile": "9999999999",
  "address": "New Address, Mumbai"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "id": 2,
    "name": "Priya Sharma",
    "mobile": "9999999999",
    "email": "priya@example.com",
    "address": "New Address, Mumbai",
    "gstNumber": "29ABCDE1234F1Z5",
    "isGuest": false,
    "createdAt": "2026-01-17T12:00:00.000Z",
    "updatedAt": "2026-01-17T15:00:00.000Z"
  }
}
```

---

## 3️⃣ PRODUCT ENDPOINTS

### 3.1 Create Product (Admin Only)
```http
POST /api/products
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Tata Tea Premium",
  "sku": "TEA-TAT-500",
  "description": "500g Premium Tea Pack",
  "price": 250.00,
  "stockQuantity": 100,
  "minStockAlert": 10,
  "category": "Beverages",
  "unit": "PCS",
  "taxRate": 12.0
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 5,
    "name": "Tata Tea Premium",
    "sku": "TEA-TAT-500",
    "description": "500g Premium Tea Pack",
    "price": "250.00",
    "stockQuantity": 100,
    "minStockAlert": 10,
    "category": "Beverages",
    "unit": "PCS",
    "isActive": true,
    "taxRate": "12.00",
    "createdAt": "2026-01-17T12:30:00.000Z",
    "updatedAt": "2026-01-17T12:30:00.000Z"
  }
}
```

---

### 3.2 Get All Products
```http
GET /api/products?category=Groceries&isActive=true&search=Rice
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "name": "Rice (Basmati)",
      "sku": "RICE-BAS-001",
      "description": "1 KG Premium Basmati Rice",
      "price": "120.00",
      "stockQuantity": 95,
      "minStockAlert": 10,
      "category": "Groceries",
      "unit": "KG",
      "isActive": true,
      "taxRate": "5.00",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-17T14:00:00.000Z"
    }
  ]
}
```

---

### 3.3 Get Product by ID
```http
GET /api/products/1
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Rice (Basmati)",
    "sku": "RICE-BAS-001",
    "description": "1 KG Premium Basmati Rice",
    "price": "120.00",
    "stockQuantity": 95,
    "minStockAlert": 10,
    "category": "Groceries",
    "unit": "KG",
    "isActive": true,
    "taxRate": "5.00",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-17T14:00:00.000Z",
    "inventoryLogs": [
      {
        "id": 12,
        "transactionType": "SALE",
        "quantityChange": -5,
        "previousStock": 100,
        "newStock": 95,
        "referenceId": 3,
        "notes": "Sale via Invoice INV-20260117-0002",
        "createdAt": "2026-01-17T14:00:00.000Z"
      },
      {
        "id": 8,
        "transactionType": "RESTOCK",
        "quantityChange": 50,
        "previousStock": 50,
        "newStock": 100,
        "referenceId": null,
        "notes": "Weekly restock",
        "createdAt": "2026-01-16T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 3.4 Update Stock (Admin Only)
```http
PATCH /api/products/1/stock
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "quantity": 50,
  "type": "RESTOCK",
  "notes": "Weekly restock from supplier"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Stock updated successfully",
  "data": {
    "id": 1,
    "name": "Rice (Basmati)",
    "sku": "RICE-BAS-001",
    "stockQuantity": 145,
    "updatedAt": "2026-01-17T15:30:00.000Z"
  }
}
```

---

### 3.5 Get Low Stock Products
```http
GET /api/products/low-stock
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 3,
      "name": "Amul Butter",
      "sku": "BUTTER-AMU-500",
      "stockQuantity": 3,
      "minStockAlert": 5,
      "category": "Dairy",
      "price": "250.00"
    },
    {
      "id": 2,
      "name": "Tata Salt",
      "sku": "SALT-TAT-001",
      "stockQuantity": 8,
      "minStockAlert": 20,
      "category": "Groceries",
      "price": "20.00"
    }
  ]
}
```

---

## 4️⃣ INVOICE ENDPOINTS ⭐ (CRITICAL)

### 4.1 Create Invoice (Guest Customer)
```http
POST /api/invoices
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "customerId": 1,
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
  "discount": 10.00,
  "paymentMode": "CASH",
  "paymentStatus": "PAID",
  "notes": "Walk-in customer, discount applied"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "id": 1,
    "invoiceNumber": "INV-20260117-0001",
    "customerId": 1,
    "subtotal": "340.00",
    "taxAmount": "17.00",
    "discount": "10.00",
    "totalAmount": "347.00",
    "paymentMode": "CASH",
    "paymentStatus": "PAID",
    "notes": "Walk-in customer, discount applied",
    "createdAt": "2026-01-17T16:00:00.000Z",
    "updatedAt": "2026-01-17T16:00:00.000Z",
    "customer": {
      "id": 1,
      "name": "Guest Customer",
      "mobile": null,
      "email": null,
      "isGuest": true
    },
    "items": [
      {
        "id": 1,
        "invoiceId": 1,
        "productId": 1,
        "productName": "Rice (Basmati)",
        "quantity": 2,
        "unitPrice": "120.00",
        "taxRate": "5.00",
        "taxAmount": "12.00",
        "lineTotal": "252.00",
        "createdAt": "2026-01-17T16:00:00.000Z",
        "product": {
          "id": 1,
          "name": "Rice (Basmati)",
          "sku": "RICE-BAS-001"
        }
      },
      {
        "id": 2,
        "invoiceId": 1,
        "productId": 2,
        "productName": "Tata Salt",
        "quantity": 5,
        "unitPrice": "20.00",
        "taxRate": "5.00",
        "taxAmount": "5.00",
        "lineTotal": "105.00",
        "createdAt": "2026-01-17T16:00:00.000Z",
        "product": {
          "id": 2,
          "name": "Tata Salt",
          "sku": "SALT-TAT-001"
        }
      }
    ]
  }
}
```

**What Happened Behind the Scenes:**
1. ✅ Validated customer exists (Guest customer ID: 1)
2. ✅ Fetched products (Rice & Salt)
3. ✅ Checked stock: Rice (95 available, need 2 ✓), Salt (195 available, need 5 ✓)
4. ✅ Calculated totals with tax
5. ✅ Generated invoice number: INV-20260117-0001
6. ✅ Created invoice record
7. ✅ Created 2 invoice items
8. ✅ Decremented stock: Rice (95→93), Salt (195→190)
9. ✅ Created 2 inventory logs for audit trail

---

### 4.2 Create Invoice (Insufficient Stock)
```http
POST /api/invoices
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "customerId": 2,
  "items": [
    {
      "productId": 1,
      "quantity": 500
    }
  ],
  "paymentMode": "CARD"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Insufficient stock for product \"Rice (Basmati)\". Available: 93, Requested: 500"
}
```

**Database State:** UNCHANGED (transaction rolled back)

---

### 4.3 Create Invoice (Regular Customer with Multiple Items)
```http
POST /api/invoices
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "customerId": 2,
  "items": [
    {
      "productId": 1,
      "quantity": 5
    },
    {
      "productId": 3,
      "quantity": 2
    },
    {
      "productId": 4,
      "quantity": 10
    }
  ],
  "discount": 50.00,
  "paymentMode": "UPI",
  "paymentStatus": "PAID"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "id": 2,
    "invoiceNumber": "INV-20260117-0002",
    "customerId": 2,
    "subtotal": "1220.00",
    "taxAmount": "87.60",
    "discount": "50.00",
    "totalAmount": "1257.60",
    "paymentMode": "UPI",
    "paymentStatus": "PAID",
    "notes": null,
    "createdAt": "2026-01-17T16:30:00.000Z",
    "customer": {
      "id": 2,
      "name": "Priya Sharma",
      "mobile": "9876543210",
      "email": "priya@example.com",
      "isGuest": false
    },
    "items": [...]
  }
}
```

---

### 4.4 Get All Invoices (with filters)
```http
GET /api/invoices?startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z&paymentMode=CASH&page=1&limit=20
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoiceNumber": "INV-20260117-0001",
      "customerId": 1,
      "subtotal": "340.00",
      "taxAmount": "17.00",
      "discount": "10.00",
      "totalAmount": "347.00",
      "paymentMode": "CASH",
      "paymentStatus": "PAID",
      "notes": "Walk-in customer, discount applied",
      "createdAt": "2026-01-17T16:00:00.000Z",
      "customer": {
        "id": 1,
        "name": "Guest Customer",
        "mobile": null,
        "isGuest": true
      },
      "_count": {
        "items": 2
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 4.5 Get Invoice by ID
```http
GET /api/invoices/1
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoiceNumber": "INV-20260117-0001",
    "customerId": 1,
    "subtotal": "340.00",
    "taxAmount": "17.00",
    "discount": "10.00",
    "totalAmount": "347.00",
    "paymentMode": "CASH",
    "paymentStatus": "PAID",
    "notes": "Walk-in customer, discount applied",
    "createdAt": "2026-01-17T16:00:00.000Z",
    "updatedAt": "2026-01-17T16:00:00.000Z",
    "customer": {
      "id": 1,
      "name": "Guest Customer",
      "mobile": null,
      "email": null,
      "isGuest": true
    },
    "items": [
      {
        "id": 1,
        "productName": "Rice (Basmati)",
        "quantity": 2,
        "unitPrice": "120.00",
        "taxRate": "5.00",
        "taxAmount": "12.00",
        "lineTotal": "252.00",
        "product": {
          "id": 1,
          "name": "Rice (Basmati)",
          "sku": "RICE-BAS-001",
          "unit": "KG"
        }
      },
      {
        "id": 2,
        "productName": "Tata Salt",
        "quantity": 5,
        "unitPrice": "20.00",
        "taxRate": "5.00",
        "taxAmount": "5.00",
        "lineTotal": "105.00",
        "product": {
          "id": 2,
          "name": "Tata Salt",
          "sku": "SALT-TAT-001",
          "unit": "KG"
        }
      }
    ]
  }
}
```

---

### 4.6 Get Sales Summary (Admin Only)
```http
GET /api/invoices/summary?startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z
Authorization: Bearer YOUR_TOKEN
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalSales": "15847.60",
    "totalInvoices": 23,
    "paymentModeSummary": [
      {
        "paymentMode": "CASH",
        "_sum": {
          "totalAmount": "8500.00"
        },
        "_count": 15
      },
      {
        "paymentMode": "UPI",
        "_sum": {
          "totalAmount": "5240.50"
        },
        "_count": 6
      },
      {
        "paymentMode": "CARD",
        "_sum": {
          "totalAmount": "2107.10"
        },
        "_count": 2
      }
    ]
  }
}
```

---

## ❌ ERROR RESPONSES

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Authentication token required"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "message": "Forbidden: Insufficient permissions"
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Invoice not found"
}
```

### Rate Limit (429)
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Internal Server Error"
}
```

---

## 📝 Notes

### Invoice Calculation Logic:
```
Item 1: Rice (2 KG × ₹120) = ₹240
Item 1 Tax: ₹240 × 5% = ₹12
Item 1 Total: ₹240 + ₹12 = ₹252

Item 2: Salt (5 KG × ₹20) = ₹100
Item 2 Tax: ₹100 × 5% = ₹5
Item 2 Total: ₹100 + ₹5 = ₹105

Subtotal: ₹240 + ₹100 = ₹340
Tax Amount: ₹12 + ₹5 = ₹17
Discount: ₹10
Total Amount: ₹340 + ₹17 - ₹10 = ₹347
```

### Stock Deduction Logic:
```
Before Invoice:
- Rice: 100 units
- Salt: 200 units

After Invoice (2 Rice, 5 Salt):
- Rice: 100 - 2 = 98 units
- Salt: 200 - 5 = 195 units

Inventory Logs Created:
- Rice: SALE, -2, 100 → 98
- Salt: SALE, -5, 200 → 195
```

---

This documentation provides complete examples of all API endpoints with realistic request/response data.
