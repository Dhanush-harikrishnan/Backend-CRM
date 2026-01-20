import { z } from 'zod';

// ============================================
// COMMON VALIDATORS
// ============================================
const idParam = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid ID'),
});

const paginationQuery = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const dateRangeQuery = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Indian GST Number validation
const gstNumberValidator = z.string()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST number format')
  .optional()
  .nullable();

// Indian mobile number validation
const mobileValidator = z.string()
  .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number')
  .optional()
  .nullable();

// Indian PAN number validation
const panValidator = z.string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format')
  .optional()
  .nullable();

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
    organizationId: z.string().uuid().optional(),
    role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF']).optional(),
  }),
});

// ============================================
// ORGANIZATION VALIDATION SCHEMAS
// ============================================
export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters'),
    businessType: z.enum(['INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'TRUST', 'SOCIETY', 'OTHER']).optional(),
    industry: z.string().optional(),
    gstin: gstNumberValidator,
    pan: panValidator,
    email: z.string().email().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional().nullable(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode').optional(),
    country: z.string().default('India'),
    currencyCode: z.string().default('INR'),
    financialYearStart: z.number().min(1).max(12).default(4),
    invoicePrefix: z.string().optional(),
    estimatePrefix: z.string().optional(),
  }),
});

export const updateOrganizationSchema = z.object({
  body: createOrganizationSchema.shape.body.partial(),
});

// ============================================
// CUSTOMER VALIDATION SCHEMAS
// ============================================
export const createCustomerSchema = z.object({
  body: z.object({
    customerType: z.enum(['BUSINESS', 'INDIVIDUAL']).default('INDIVIDUAL'),
    displayName: z.string().min(2, 'Display name must be at least 2 characters'),
    companyName: z.string().optional().nullable(),
    salutation: z.string().optional().nullable(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    email: z.string().email('Invalid email format').optional().nullable(),
    mobile: mobileValidator,
    phone: z.string().optional().nullable(),

    // GST Details
    gstTreatment: z.enum(['REGISTERED', 'UNREGISTERED', 'CONSUMER', 'OVERSEAS', 'SEZ', 'DEEMED_EXPORT']).default('CONSUMER'),
    gstin: gstNumberValidator,
    placeOfSupply: z.string().optional().nullable(),

    // Address
    billingAddress: z.string().optional().nullable(),
    billingCity: z.string().optional().nullable(),
    billingState: z.string().optional().nullable(),
    billingPincode: z.string().regex(/^\d{6}$/, 'Invalid pincode').optional().nullable(),
    billingCountry: z.string().default('India'),

    shippingAddress: z.string().optional().nullable(),
    shippingCity: z.string().optional().nullable(),
    shippingState: z.string().optional().nullable(),
    shippingPincode: z.string().regex(/^\d{6}$/, 'Invalid pincode').optional().nullable(),
    shippingCountry: z.string().default('India'),

    // Other
    creditLimit: z.number().min(0).optional(),
    paymentTerms: z.number().min(0).optional(),
    pan: panValidator,
    notes: z.string().optional().nullable(),
    groupId: z.number().int().positive().optional().nullable(),
  }),
});

export const updateCustomerSchema = z.object({
  params: idParam,
  body: createCustomerSchema.shape.body.partial(),
});

export const customerListQuerySchema = z.object({
  query: paginationQuery.extend({
    search: z.string().optional(),
    customerType: z.enum(['BUSINESS', 'INDIVIDUAL']).optional(),
    groupId: z.string().regex(/^\d+$/).optional(),
    isActive: z.enum(['true', 'false']).optional(),
  }),
});

export const createCustomerGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Group name must be at least 2 characters'),
    description: z.string().optional().nullable(),
  }),
});

// ============================================
// PRODUCT VALIDATION SCHEMAS
// ============================================
export const createProductSchema = z.object({
  body: z.object({
    type: z.enum(['GOODS', 'SERVICE']).default('GOODS'),
    name: z.string().min(2, 'Product name must be at least 2 characters'),
    sku: z.string().min(1, 'SKU is required'),
    description: z.string().optional().nullable(),

    // Pricing
    sellingPrice: z.number().min(0, 'Selling price must be non-negative'),
    costPrice: z.number().min(0).optional(),
    mrp: z.number().min(0).optional().nullable(),

    // Tax
    taxId: z.number().int().positive().optional().nullable(),
    hsnCode: z.string().optional().nullable(),
    sacCode: z.string().optional().nullable(),

    // Inventory
    trackInventory: z.boolean().default(true),
    stockQuantity: z.number().int().min(0).default(0),
    lowStockThreshold: z.number().int().min(0).default(10),
    unit: z.string().default('PCS'),

    // Category
    categoryId: z.number().int().positive().optional().nullable(),

    // Other
    barcode: z.string().optional().nullable(),
  }),
});

export const updateProductSchema = z.object({
  params: idParam,
  body: createProductSchema.shape.body.partial().extend({
    isActive: z.boolean().optional(),
  }),
});

export const productListQuerySchema = z.object({
  query: paginationQuery.extend({
    search: z.string().optional(),
    type: z.enum(['GOODS', 'SERVICE']).optional(),
    categoryId: z.string().regex(/^\d+$/).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    lowStock: z.enum(['true', 'false']).optional(),
  }),
});

export const adjustStockSchema = z.object({
  params: idParam,
  body: z.object({
    quantity: z.number().int('Quantity must be an integer'),
    type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'DAMAGED', 'TRANSFER']),
    reason: z.string().optional(),
    notes: z.string().optional().nullable(),
  }),
});

export const createProductCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters'),
    description: z.string().optional().nullable(),
    parentId: z.number().int().positive().optional().nullable(),
  }),
});

// ============================================
// TAX VALIDATION SCHEMAS
// ============================================
export const createTaxSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Tax name must be at least 2 characters'),
    taxType: z.enum(['GST', 'IGST', 'CESS', 'CUSTOM']).default('GST'),
    rate: z.number().min(0).max(100, 'Rate must be between 0 and 100'),
    cgstRate: z.number().min(0).max(50).optional().nullable(),
    sgstRate: z.number().min(0).max(50).optional().nullable(),
    igstRate: z.number().min(0).max(100).optional().nullable(),
    cessRate: z.number().min(0).max(100).optional().nullable(),
    description: z.string().optional().nullable(),
    isDefault: z.boolean().optional(),
  }),
});

// ============================================
// INVOICE VALIDATION SCHEMAS
// ============================================
const invoiceItemSchema = z.object({
  productId: z.union([z.number().int().positive(), z.string()]).optional().nullable(), // Accept both number and MongoDB ObjectId string
  itemType: z.enum(['GOODS', 'SERVICE']).optional(),
  name: z.string().optional().nullable(), // Made optional - will be looked up from product if not provided
  description: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  sacCode: z.string().optional().nullable(),
  quantity: z.union([z.number().positive('Quantity must be positive'), z.string().transform(val => parseFloat(val))]),
  unit: z.string().optional().nullable(),
  rate: z.union([z.number().min(0), z.string().transform(val => parseFloat(val))]).optional().nullable(), // Accept string too
  price: z.union([z.number().min(0), z.string().transform(val => parseFloat(val))]).optional().nullable(), // Accept 'price' as alias for 'rate'
  taxRate: z.number().min(0).optional().nullable(), // Accept taxRate from frontend
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional().nullable(),
  discountValue: z.union([z.number().min(0), z.string().transform(val => parseFloat(val) || 0)]).optional().nullable(),
  taxId: z.union([z.number().int().positive(), z.string()]).optional().nullable(), // Accept both number and string
});

export const createInvoiceSchema = z.object({
  body: z.object({
    customerId: z.union([z.number().int().positive(), z.string()]).optional().nullable(), // Accept both number and MongoDB ObjectId string
    customerName: z.string().optional().nullable(), // For walk-in customers without account
    customerPhone: z.string().optional().nullable(),
    customerEmail: z.string().email().optional().nullable().or(z.literal('')).or(z.undefined()), // Allow empty string, null, undefined
    estimateId: z.union([z.number().int().positive(), z.string()]).optional(),
    referenceNumber: z.string().optional(),
    orderNumber: z.string().optional().nullable(),
    invoiceDate: z.string().optional().nullable(), // Accept any date string format - will be parsed in service
    dueDate: z.string().optional().nullable(), // Accept any date string format - will be parsed in service
    placeOfSupply: z.string().optional().nullable(),

    items: z.array(invoiceItemSchema).min(1, 'Invoice must have at least one item'),

    // Accept calculated totals from frontend
    subtotal: z.union([z.number(), z.string().transform(val => parseFloat(val))]).optional().nullable(),
    taxableAmount: z.union([z.number(), z.string().transform(val => parseFloat(val))]).optional().nullable(),
    totalAmount: z.union([z.number(), z.string().transform(val => parseFloat(val))]).optional().nullable(),

    discountType: z.enum(['FIXED', 'PERCENTAGE']).optional().nullable(),
    discountValue: z.union([z.number().min(0), z.string().transform(val => parseFloat(val) || 0)]).optional().nullable(),
    discount: z.union([z.number().min(0), z.string().transform(val => parseFloat(val) || 0)]).optional().nullable(), // Alternative field name
    shippingCharge: z.union([z.number().min(0), z.string().transform(val => parseFloat(val) || 0)]).optional().nullable(),
    shipping: z.union([z.number().min(0), z.string().transform(val => parseFloat(val) || 0)]).optional().nullable(), // Alternative field name
    adjustmentAmount: z.union([z.number(), z.string().transform(val => parseFloat(val) || 0)]).optional().nullable(),
    adjustmentDesc: z.string().optional().nullable(),

    customerNotes: z.string().optional().nullable(),
    termsConditions: z.string().optional().nullable(),
    privateNotes: z.string().optional().nullable(),

    status: z.enum(['DRAFT', 'SENT', 'PENDING']).optional().nullable(), // Added PENDING for frontend compatibility
  }),
});

export const updateInvoiceSchema = z.object({
  params: idParam,
  body: createInvoiceSchema.shape.body.partial(),
});

export const invoiceListQuerySchema = z.object({
  query: paginationQuery.merge(dateRangeQuery).extend({
    search: z.string().optional(),
    customerId: z.string().regex(/^\d+$/).optional(),
    status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PAID', 'VOID']).optional(),
    paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
    overdue: z.enum(['true', 'false']).optional(),
  }),
});

export const recordPaymentSchema = z.object({
  params: idParam,
  body: z.object({
    amount: z.union([z.number().positive('Amount must be positive'), z.string().transform(val => parseFloat(val))]),
    paymentDate: z.string().optional().nullable(),
    paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'NETBANKING', 'CHEQUE', 'BANK_TRANSFER']).optional(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

// ============================================
// ESTIMATE VALIDATION SCHEMAS
// ============================================
export const createEstimateSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    referenceNumber: z.string().optional(),
    estimateDate: z.string().datetime().optional(),
    expiryDate: z.string().datetime().optional(),
    placeOfSupply: z.string().optional(),

    items: z.array(invoiceItemSchema).min(1, 'Estimate must have at least one item'),

    discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    discountValue: z.number().min(0).optional(),
    shippingCharge: z.number().min(0).optional(),
    adjustmentAmount: z.number().optional(),
    adjustmentDesc: z.string().optional(),

    customerNotes: z.string().optional(),
    termsConditions: z.string().optional(),
    privateNotes: z.string().optional(),
  }),
});

export const updateEstimateSchema = z.object({
  params: idParam,
  body: createEstimateSchema.shape.body.partial(),
});

export const estimateListQuerySchema = z.object({
  query: paginationQuery.merge(dateRangeQuery).extend({
    search: z.string().optional(),
    customerId: z.string().regex(/^\d+$/).optional(),
    status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED']).optional(),
  }),
});

// ============================================
// CREDIT NOTE VALIDATION SCHEMAS
// ============================================
export const createCreditNoteSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    invoiceId: z.number().int().positive().optional(),
    creditNoteDate: z.string().datetime().optional(),
    reason: z.enum(['SALES_RETURN', 'POST_SALE_DISCOUNT', 'DEFICIENCY_IN_SERVICE', 'CORRECTION', 'CHANGE_IN_POS', 'FINALIZATION_OF_PROVISIONAL', 'OTHER']),

    items: z.array(invoiceItemSchema).min(1, 'Credit note must have at least one item'),

    discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    discountValue: z.number().min(0).optional(),

    notes: z.string().optional(),
    restoreStock: z.boolean().default(true),
  }),
});

export const creditNoteListQuerySchema = z.object({
  query: paginationQuery.merge(dateRangeQuery).extend({
    search: z.string().optional(),
    customerId: z.string().regex(/^\d+$/).optional(),
    invoiceId: z.string().regex(/^\d+$/).optional(),
    status: z.enum(['DRAFT', 'OPEN', 'APPLIED', 'VOID']).optional(),
  }),
});

export const applyCreditNoteSchema = z.object({
  params: idParam,
  body: z.object({
    invoiceId: z.number().int().positive('Invoice ID is required'),
    amount: z.number().positive('Amount must be positive'),
  }),
});

// ============================================
// PAYMENT VALIDATION SCHEMAS
// ============================================
export const createPaymentSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    invoiceId: z.number().int().positive().optional(),
    amount: z.number().positive('Amount must be positive'),
    paymentDate: z.string().datetime().optional(),
    paymentMode: z.enum(['CASH']).default('CASH'), // Only CASH for now
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updatePaymentSchema = z.object({
  params: idParam,
  body: z.object({
    paymentDate: z.string().datetime().optional(),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const paymentListQuerySchema = z.object({
  query: paginationQuery.merge(dateRangeQuery).extend({
    search: z.string().optional(),
    customerId: z.string().regex(/^\d+$/).optional(),
    invoiceId: z.string().regex(/^\d+$/).optional(),
    paymentMode: z.enum(['CASH']).optional(),
  }),
});

export const bulkPaymentSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    totalAmount: z.number().positive('Total amount must be positive'),
    paymentDate: z.string().datetime().optional(),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
    invoiceAllocations: z.array(z.object({
      invoiceId: z.number().int().positive(),
      amount: z.number().positive(),
    })).min(1, 'At least one invoice allocation is required'),
  }),
});

// ============================================
// EXPENSE VALIDATION SCHEMAS
// ============================================
export const createExpenseSchema = z.object({
  body: z.object({
    categoryId: z.number().int().positive().optional(),
    vendorName: z.string().optional(),
    vendorGstin: gstNumberValidator,
    expenseDate: z.string().datetime().optional(),
    amount: z.number().positive('Amount must be positive'),
    taxId: z.number().int().positive().optional(),
    isTaxInclusive: z.boolean().optional(),
    referenceNumber: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    attachmentUrl: z.string().url().optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: idParam,
  body: createExpenseSchema.shape.body.partial(),
});

export const expenseListQuerySchema = z.object({
  query: paginationQuery.merge(dateRangeQuery).extend({
    search: z.string().optional(),
    categoryId: z.string().regex(/^\d+$/).optional(),
    vendorName: z.string().optional(),
  }),
});

export const createExpenseCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters'),
    description: z.string().optional().nullable(),
  }),
});

// ============================================
// REPORT VALIDATION SCHEMAS
// ============================================
export const reportDateRangeSchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    customerId: z.string().regex(/^\d+$/).optional(),
    productId: z.string().regex(/^\d+$/).optional(),
    categoryId: z.string().regex(/^\d+$/).optional(),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>['body'];
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>['body'];
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>['body'];
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>['body'];
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>['body'];
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>['body'];
