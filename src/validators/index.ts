import { z } from 'zod';

// ============================================
// AUTH VALIDATION SCHEMAS
// ============================================
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['ADMIN', 'STAFF']).optional(),
  }),
});

// ============================================
// CUSTOMER VALIDATION SCHEMAS
// ============================================
export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    mobile: z.string()
      .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number')
      .optional()
      .nullable(),
    email: z.string().email('Invalid email format').optional().nullable(),
    address: z.string().optional().nullable(),
    gstNumber: z.string()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST number format')
      .optional()
      .nullable(),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid customer ID'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    mobile: z.string().regex(/^[6-9]\d{9}$/).optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().optional().nullable(),
    gstNumber: z.string()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/)
      .optional()
      .nullable(),
  }),
});

// ============================================
// PRODUCT VALIDATION SCHEMAS
// ============================================
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters'),
    sku: z.string().min(3, 'SKU must be at least 3 characters'),
    description: z.string().optional().nullable(),
    price: z.number().positive('Price must be positive'),
    stockQuantity: z.number().int().min(0, 'Stock quantity cannot be negative').default(0),
    minStockAlert: z.number().int().min(0).default(5),
    category: z.string().optional().nullable(),
    unit: z.string().default('PCS'),
    taxRate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100').default(18),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid product ID'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    sku: z.string().min(3).optional(),
    description: z.string().optional().nullable(),
    price: z.number().positive().optional(),
    stockQuantity: z.number().int().min(0).optional(),
    minStockAlert: z.number().int().min(0).optional(),
    category: z.string().optional().nullable(),
    unit: z.string().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateStockSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid product ID'),
  }),
  body: z.object({
    quantity: z.number().int('Quantity must be an integer'),
    type: z.enum(['RESTOCK', 'ADJUSTMENT'], {
      errorMap: () => ({ message: 'Type must be RESTOCK or ADJUSTMENT' }),
    }),
    notes: z.string().optional().nullable(),
  }),
});

// ============================================
// INVOICE VALIDATION SCHEMAS
// ============================================
export const createInvoiceSchema = z.object({
  body: z.object({
    customerId: z.number()
      .int()
      .positive('Customer ID must be positive')
      .default(1), // Default to Guest customer
    items: z.array(
      z.object({
        productId: z.number().int().positive('Product ID must be positive'),
        quantity: z.number().int().positive('Quantity must be positive'),
      })
    ).min(1, 'Invoice must have at least one item'),
    discount: z.number().min(0, 'Discount cannot be negative').default(0),
    paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'CREDIT', 'NETBANKING'], {
      errorMap: () => ({ message: 'Invalid payment mode' }),
    }),
    paymentStatus: z.enum(['PAID', 'PENDING', 'PARTIAL']).default('PAID'),
    notes: z.string().optional().nullable(),
  }),
});

export const getInvoiceByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid invoice ID'),
  }),
});

export const getInvoicesQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    customerId: z.string().regex(/^\d+$/).optional(),
    paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'CREDIT', 'NETBANKING']).optional(),
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
  }),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>['body'];
export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];

// ============================================
// PAYMENT VALIDATION SCHEMAS
// ============================================
export const createPaymentIntentSchema = z.object({
  body: z.object({
    invoiceId: z.number().int().positive('Invoice ID must be positive'),
  }),
});

export const createRefundSchema = z.object({
  body: z.object({
    paymentIntentId: z.string().min(1, 'Payment Intent ID is required'),
    amount: z.number().positive('Amount must be positive').optional(),
  }),
});
