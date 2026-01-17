# Transaction Logic Explanation

## Overview
The invoice creation endpoint implements **atomic transactions** using Prisma's `$transaction` API. This ensures that either ALL operations succeed, or ALL operations are rolled back - critical for financial and inventory systems.

## Why Transactions Matter

In an inventory & billing system:
1. Money is involved (invoices)
2. Physical stock is tracked
3. Multiple database operations must succeed together
4. Partial updates can cause data corruption

**Example Scenario:**
```
1. Create invoice ✅
2. Create invoice items ✅
3. Deduct stock ❌ (FAILS - insufficient stock)

Without transaction: Invoice is created but stock is not deducted = DATA CORRUPTION
With transaction: Everything is rolled back = DATA INTEGRITY MAINTAINED
```

## Implementation

### File: `src/services/invoice.service.ts`

```typescript
async createInvoice(data: CreateInvoiceInput) {
  // Use Prisma Transaction
  const result = await prisma.$transaction(async (tx) => {
    
    // STEP 1: Fetch all products and validate existence
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });
    
    // STEP 2: Validate stock availability BEFORE any writes
    for (const item of items) {
      const product = productMap.get(item.productId);
      
      // CRITICAL CHECK: If insufficient stock, throw error
      if (product.stockQuantity < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
          400
        );
      }
      
      // Calculate amounts...
    }
    
    // STEP 3: Generate unique invoice number
    const invoiceNumber = await this.generateInvoiceNumber(tx);
    
    // STEP 4: Create Invoice record
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        subtotal,
        taxAmount,
        discount,
        totalAmount,
        paymentMode,
        paymentStatus,
      },
    });
    
    // STEP 5: Create Invoice Items (bulk insert)
    await tx.invoiceItem.createMany({
      data: invoiceItemsData.map((itemData) => ({
        invoiceId: invoice.id,
        ...itemData,
      })),
    });
    
    // STEP 6: Decrement stock quantities
    for (const item of items) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: {
            decrement: item.quantity,  // Atomic decrement
          },
        },
      });
      
      // STEP 7: Create inventory log (audit trail)
      await tx.inventoryLog.create({
        data: {
          productId: product.id,
          transactionType: 'SALE',
          quantityChange: -item.quantity,  // Negative for sale
          previousStock: product.stockQuantity,
          newStock: product.stockQuantity - item.quantity,
          referenceId: invoice.id,
          notes: `Sale via Invoice ${invoiceNumber}`,
        },
      });
    }
    
    // Return the complete invoice with relations
    return tx.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        customer: true,
        items: true,
      },
    });
  });
  
  return result;
}
```

## Transaction Guarantees

### ✅ Atomicity
All operations complete successfully or none do. No partial updates.

### ✅ Consistency
Database moves from one valid state to another. Stock levels always accurate.

### ✅ Isolation
Concurrent transactions don't interfere with each other. No race conditions.

### ✅ Durability
Once committed, changes are permanent even if system crashes.

## Error Scenarios

### 1. Insufficient Stock
```json
Request:
{
  "customerId": 1,
  "items": [
    { "productId": 1, "quantity": 100 }  // Only 50 available
  ],
  "paymentMode": "CASH"
}

Response (400):
{
  "success": false,
  "message": "Insufficient stock for product \"Rice (Basmati)\". Available: 50, Requested: 100"
}

Database State: NO CHANGES (rolled back)
```

### 2. Product Not Found
```json
Request:
{
  "customerId": 1,
  "items": [
    { "productId": 999, "quantity": 2 }  // Product doesn't exist
  ],
  "paymentMode": "CASH"
}

Response (404):
{
  "success": false,
  "message": "Product with ID 999 not found"
}

Database State: NO CHANGES (rolled back)
```

### 3. Database Connection Lost
```
Scenario: Connection lost during Step 5

Result: Transaction is automatically rolled back by database
- Invoice NOT created
- Invoice items NOT created
- Stock NOT deducted
- Inventory logs NOT created

Database State: UNCHANGED
```

## Guest Customer Handling

The system includes a pre-seeded Guest customer (ID: 1) for walk-in sales:

```typescript
// In seed.ts
const guestCustomer = await prisma.customer.upsert({
  where: { id: 1 },
  update: {},
  create: {
    id: 1,
    name: 'Guest Customer',
    mobile: null,
    email: null,
    isGuest: true,
  },
});
```

### Usage in Invoice Creation:

```json
{
  "customerId": 1,  // Guest customer - no registration required
  "items": [...],
  "paymentMode": "CASH"
}
```

### Business Logic:

1. **Default Value**: Zod validator defaults `customerId` to 1 if not provided
   ```typescript
   customerId: z.number().int().positive().default(1)
   ```

2. **Validation**: Service validates customer exists (including Guest)
   ```typescript
   const customer = await prisma.customer.findUnique({
     where: { id: customerId },
   });
   
   if (!customer) {
     throw new AppError('Customer not found', 404);
   }
   ```

3. **Protection**: Guest customer cannot be updated or deleted
   ```typescript
   if (customer.isGuest) {
     throw new AppError('Cannot update guest customer', 400);
   }
   ```

4. **Filtering**: Guest customer excluded from customer listings
   ```typescript
   const where = {
     isGuest: false,  // Only show real customers
   };
   ```

## Performance Considerations

### 1. Bulk Operations
Use `createMany` instead of multiple `create` calls:
```typescript
// ✅ Good - Single query
await tx.invoiceItem.createMany({ data: items });

// ❌ Bad - Multiple queries
for (const item of items) {
  await tx.invoiceItem.create({ data: item });
}
```

### 2. Atomic Updates
Use database-level operations:
```typescript
// ✅ Good - Atomic decrement
await tx.product.update({
  data: { stockQuantity: { decrement: quantity } }
});

// ❌ Bad - Race condition possible
const product = await tx.product.findUnique(...);
await tx.product.update({
  data: { stockQuantity: product.stockQuantity - quantity }
});
```

### 3. Transaction Timeout
Keep transactions short to avoid locks:
- Validate BEFORE starting transaction
- Perform calculations outside transaction
- Only database operations inside transaction

## Testing Recommendations

### Test Case 1: Successful Invoice
```typescript
// Setup
Product A: stock = 100

// Action
Create invoice with 10 units of Product A

// Assert
- Invoice created ✓
- Invoice items created ✓
- Product A stock = 90 ✓
- Inventory log created ✓
```

### Test Case 2: Insufficient Stock
```typescript
// Setup
Product B: stock = 5

// Action
Create invoice with 10 units of Product B

// Assert
- Error thrown ✓
- Invoice NOT created ✓
- Product B stock = 5 (unchanged) ✓
- No inventory log ✓
```

### Test Case 3: Concurrent Transactions
```typescript
// Setup
Product C: stock = 10

// Action
Transaction 1: Buy 8 units
Transaction 2: Buy 8 units (simultaneously)

// Assert
- One succeeds ✓
- One fails with insufficient stock ✓
- Final stock = 2 ✓
```

## Monitoring & Debugging

### Logs
```typescript
logger.info(`Invoice created: ${invoiceNumber} for customer ${customerId}`);
logger.debug(`Stock decremented: ${product.id}: ${oldStock} -> ${newStock}`);
logger.error(`Transaction failed: ${error.message}`);
```

### Audit Trail
Every stock change is logged in `inventory_logs`:
```sql
SELECT * FROM inventory_logs 
WHERE product_id = 1 
ORDER BY created_at DESC;
```

### Query Performance
Enable Prisma query logging in development:
```typescript
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});
```

## Production Best Practices

1. **Database Connection Pooling**
   ```typescript
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL,
       },
     },
   });
   ```

2. **Transaction Retry Logic**
   For serialization failures:
   ```typescript
   let retries = 3;
   while (retries > 0) {
     try {
       return await prisma.$transaction(...);
     } catch (error) {
       if (error.code === 'P2034' && retries > 0) {
         retries--;
         await sleep(100);
         continue;
       }
       throw error;
     }
   }
   ```

3. **Deadlock Prevention**
   - Always access tables in same order
   - Keep transactions short
   - Use appropriate isolation levels

4. **Monitoring**
   - Track transaction duration
   - Alert on high failure rates
   - Monitor database locks

## Summary

The transaction logic ensures:
- ✅ **Data Integrity**: No partial updates
- ✅ **Stock Accuracy**: Real-time inventory tracking
- ✅ **Audit Trail**: Complete history of stock changes
- ✅ **Error Safety**: Automatic rollback on failures
- ✅ **Concurrency**: Safe multi-user operations
- ✅ **Business Rules**: Stock validation before sale

This makes the system production-ready for handling real money and physical inventory.
