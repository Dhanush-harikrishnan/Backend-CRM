# 🚀 QUICK START - 5 Minutes to First API Call

## Step 1: Install (30 seconds)
```bash
npm install
```

## Step 2: Environment Setup (1 minute)
```bash
# Copy template
Copy-Item .env.example .env

# Edit .env and add your Neon.tech database URL:
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
JWT_SECRET="your-secret-key-here"
```

## Step 3: Database Setup (1 minute)
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Step 4: Start Server (5 seconds)
```bash
npm run dev
```

Expected output:
```
🚀 Server running in development mode on port 5000
📍 Health check: http://localhost:5000/health
📍 API Base URL: http://localhost:5000/api
```

## Step 5: First API Call (30 seconds)

### 5.1 Login (Get Token)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@shop.com\",\"password\":\"Admin@123\"}"
```

**Copy the `token` from response!**

### 5.2 Create Invoice (Use Token)
```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":1,\"items\":[{\"productId\":1,\"quantity\":2}],\"paymentMode\":\"CASH\"}"
```

## ✅ Success!

If you see:
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "invoiceNumber": "INV-20260117-0001",
    ...
  }
}
```

**Congratulations! Your API is working!** 🎉

---

## 📖 What's Next?

| Learn About | Read This |
|-------------|-----------|
| All API Endpoints | [README.md](README.md) |
| How Transactions Work | [TRANSACTION_LOGIC.md](TRANSACTION_LOGIC.md) |
| Complete API Examples | [API_EXAMPLES.md](API_EXAMPLES.md) |
| Project Architecture | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) |
| Implementation Details | [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) |

---

## 🛠️ Quick Commands

```bash
# Development
npm run dev              # Start dev server with auto-reload
npm run build           # Compile TypeScript
npm start               # Run production build

# Database
npm run prisma:studio   # Open database GUI
npm run prisma:migrate  # Run migrations

# Testing
curl http://localhost:5000/health  # Health check
```

---

## 🎯 Default Credentials

**Admin User:**
- Email: `admin@shop.com`
- Password: `Admin@123`

**Guest Customer:**
- ID: `1` (use this for walk-in sales)

---

## 📊 Pre-seeded Data

After running `npm run prisma:seed`:
- ✅ 1 Admin user
- ✅ 1 Guest customer (ID: 1)
- ✅ 2 Regular customers
- ✅ 4 Products (Rice, Salt, Butter, Maggi)

---

## 🔥 Try These Commands

### Get All Products
```bash
curl http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Low Stock Alert
```bash
curl http://localhost:5000/api/products/low-stock \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Sales Summary
```bash
curl http://localhost:5000/api/invoices/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚡ Power User Tip

### Use Prisma Studio (Database GUI)
```bash
npm run prisma:studio
```
Opens at `http://localhost:5555` - Visual database editor!

---

## ❓ Troubleshooting

### Port Already in Use?
Change `PORT` in `.env` to `5001` or another free port.

### Database Connection Error?
1. Check `DATABASE_URL` in `.env`
2. Verify Neon.tech database is running
3. Ensure `?sslmode=require` is in connection string

### Token Invalid?
Login again to get a fresh token (expires after 7 days by default).

---

## 📞 Need Help?

1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup instructions
2. Review error logs in `logs/` folder
3. Read [README.md](README.md) for complete documentation

---

## 🎓 Learning Path

**Beginner:**
1. ✅ Follow this quick start
2. Read [README.md](README.md) - API documentation
3. Try [API_EXAMPLES.md](API_EXAMPLES.md) - Copy-paste examples

**Intermediate:**
4. Understand [TRANSACTION_LOGIC.md](TRANSACTION_LOGIC.md) - How invoice creation works
5. Explore [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Code organization

**Advanced:**
6. Review [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Full implementation details
7. Modify code for your specific business needs

---

## 🚀 Production Deployment

Before deploying:
- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Update `DATABASE_URL` to production database
- [ ] Set `NODE_ENV=production`
- [ ] Update `FRONTEND_URL` to production URL
- [ ] Review security settings

Then:
```bash
npm run build
npm start
```

---

## ✨ Features Demo

### Create Invoice for Walk-in Customer
```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "items": [
      {"productId": 1, "quantity": 2},
      {"productId": 2, "quantity": 5}
    ],
    "discount": 10,
    "paymentMode": "CASH"
  }'
```

### Create Invoice for Regular Customer
```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 2,
    "items": [
      {"productId": 3, "quantity": 1}
    ],
    "paymentMode": "UPI"
  }'
```

---

**That's it! You're ready to build your billing system!** 🎉

For detailed documentation, see [README.md](README.md)
