# 🚀 Quick Start Guide

## Prerequisites

- Node.js v18+ installed
- PostgreSQL database (Neon.tech recommended)
- Git (optional)
- VS Code or any code editor

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages:
- Express, TypeScript
- Prisma, @prisma/client
- Security packages (helmet, cors, express-rate-limit, jsonwebtoken)
- Validation (zod)
- Logging (winston, morgan)

### 2. Create Environment File

Copy `.env.example` to `.env`:

```bash
# On Windows (PowerShell)
Copy-Item .env.example .env

# On Mac/Linux
cp .env.example .env
```

Then edit `.env` with your actual values:

```env
# Get this from Neon.tech dashboard
DATABASE_URL="postgresql://username:password@ep-xxxxx.us-east-2.aws.neon.tech/inventory_db?sslmode=require"

# Generate a strong secret (use https://randomkeygen.com/)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Other settings
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=5000
FRONTEND_URL="http://localhost:3000"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Setup Database (Neon.tech)

#### Option A: Using Neon.tech (Recommended)

1. Go to https://neon.tech/ and sign up
2. Create a new project
3. Copy the connection string
4. Paste it in your `.env` file as `DATABASE_URL`

#### Option B: Local PostgreSQL

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/inventory_db"
```

### 4. Initialize Database

```bash
# Generate Prisma Client (creates TypeScript types)
npm run prisma:generate

# Create database tables
npm run prisma:migrate

# Seed database with initial data
npm run prisma:seed
```

**What gets seeded:**
- Admin user: `admin@shop.com` / `Admin@123`
- Guest customer (ID: 1)
- 4 sample products (Rice, Salt, Butter, Maggi)
- 2 sample customers

### 5. Start Development Server

```bash
npm run dev
```

You should see:
```
🚀 Server running in development mode on port 5000
📍 Health check: http://localhost:5000/health
📍 API Base URL: http://localhost:5000/api
```

### 6. Test the API

#### Test 1: Health Check
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-01-17T10:30:00.000Z",
  "environment": "development"
}
```

#### Test 2: Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@shop.com\",\"password\":\"Admin@123\"}"
```

Copy the `token` from the response.

#### Test 3: Get Products
```bash
curl http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Test 4: Create Invoice (Guest Customer)
```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":1,\"items\":[{\"productId\":1,\"quantity\":2}],\"paymentMode\":\"CASH\"}"
```

## 🎯 Common Commands

### Development
```bash
npm run dev                 # Start dev server with auto-reload
npm run build              # Compile TypeScript to JavaScript
npm start                  # Run production build
```

### Database
```bash
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations
npm run prisma:studio      # Open Prisma Studio (GUI)
npm run prisma:seed        # Seed database
```

### Prisma Studio
Open visual database editor:
```bash
npm run prisma:studio
```
Opens at `http://localhost:5555`

## 🔍 Verify Installation

### Check 1: TypeScript Compilation
```bash
npm run build
```
Should create `dist/` folder with compiled JavaScript.

### Check 2: Database Connection
```bash
npx prisma db pull
```
Should connect successfully.

### Check 3: All Tests Pass
Login → Get Products → Create Invoice → Check Stock

## 📱 API Testing Tools

### Option 1: cURL (Command Line)
Already shown in tests above.

### Option 2: Postman
1. Download Postman
2. Import collection from `postman_collection.json` (if provided)
3. Set `{{baseUrl}}` to `http://localhost:5000/api`
4. Set `{{token}}` after login

### Option 3: VS Code REST Client
Install "REST Client" extension and use `.http` files.

Create `test.http`:
```http
### Login
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@shop.com",
  "password": "Admin@123"
}

### Get Products
GET http://localhost:5000/api/products
Authorization: Bearer YOUR_TOKEN_HERE
```

## 🐛 Troubleshooting

### Issue 1: Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill
```

Or change `PORT` in `.env` to 5001.

### Issue 2: Database Connection Error
```
Error: Can't reach database server
```

**Solutions:**
1. Check `DATABASE_URL` in `.env`
2. Verify Neon.tech database is running
3. Check internet connection
4. Ensure `?sslmode=require` is in connection string

### Issue 3: Prisma Client Not Generated
```
Error: Cannot find module '@prisma/client'
```

**Solution:**
```bash
npm run prisma:generate
```

### Issue 4: Migration Fails
```
Error: P3009 - migrations are out of sync
```

**Solution:**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Then seed again
npm run prisma:seed
```

### Issue 5: JWT Token Invalid
```
{"success":false,"message":"Invalid token"}
```

**Solutions:**
1. Check token is not expired (default: 7 days)
2. Verify `JWT_SECRET` hasn't changed
3. Get new token by logging in again

## 📊 Database Schema Verification

After migration, verify tables:

```bash
npx prisma studio
```

Should see 6 tables:
- users
- customers
- products
- invoices
- invoice_items
- inventory_logs

## 🔐 Security Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Update `FRONTEND_URL` to production URL
- [ ] Set `NODE_ENV=production`
- [ ] Use production database URL
- [ ] Review rate limit settings
- [ ] Enable HTTPS/SSL
- [ ] Disable Prisma Studio in production
- [ ] Set up log rotation
- [ ] Configure backup strategy

## 📈 Production Build

```bash
# 1. Build TypeScript
npm run build

# 2. Set environment
export NODE_ENV=production  # Mac/Linux
$env:NODE_ENV="production"  # Windows PowerShell

# 3. Run production server
npm start
```

## 🎓 Next Steps

1. **Explore API Documentation**: Read `README.md`
2. **Understand Transaction Logic**: Read `TRANSACTION_LOGIC.md`
3. **Test All Endpoints**: Use Postman or cURL
4. **Customize Business Logic**: Modify services as needed
5. **Build Frontend**: Integrate with React/Next.js frontend

## 📞 Support

If you encounter issues:
1. Check error logs in `logs/` folder
2. Review Winston logs in console
3. Check Prisma Studio for data verification
4. Refer to documentation files

## 🎉 Success!

If you can:
- ✅ Login and get JWT token
- ✅ Fetch products
- ✅ Create invoice
- ✅ See stock automatically deducted

**Congratulations!** Your API is ready for development. 🚀

---

## Quick Reference Card

```
├── Start Server:      npm run dev
├── View Database:     npm run prisma:studio
├── Check Logs:        tail -f logs/combined.log
├── Reset DB:          npx prisma migrate reset
└── Build Prod:        npm run build && npm start

Default Credentials:
└── admin@shop.com / Admin@123

Health Check:
└── http://localhost:5000/health

API Base:
└── http://localhost:5000/api
```
