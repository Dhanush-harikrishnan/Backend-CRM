import { PrismaClient, BusinessType, UserRole, CustomerType, GSTTreatment } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // 1. CREATE ORGANIZATION
  // ============================================
  console.log('📦 Creating organization...');
  
  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Trading Company',
      slug: 'demo-company',
      email: 'info@democompany.com',
      phone: '9876543210',
      businessType: BusinessType.PRIVATE_LIMITED,
      industryType: 'Trading & Distribution',
      gstNumber: '29ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      taxRegistered: true,
      addressLine1: '123 Commercial Street',
      addressLine2: 'MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      currencyCode: 'INR',
      currencySymbol: '₹',
      invoicePrefix: 'INV',
      invoiceStartNumber: 1,
      estimatePrefix: 'EST',
      estimateStartNumber: 1,
      creditNotePrefix: 'CN',
      creditNoteStartNumber: 1,
      paymentPrefix: 'PAY',
      paymentStartNumber: 1,
      defaultPaymentTerms: 30,
      defaultInvoiceNotes: 'Thank you for your business!',
      defaultTermsConditions: 'Payment is due within 30 days. Late payments may incur interest.',
    },
  });
  console.log(`✅ Organization created: ${organization.name}`);

  // ============================================
  // 2. CREATE USERS
  // ============================================
  console.log('\n👥 Creating users...');
  
  const passwordHash = await bcrypt.hash('Password@123', 12);
  
  const users = await Promise.all([
    // Owner
    prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: 'owner@democompany.com' } },
      update: {},
      create: {
        organizationId: organization.id,
        email: 'owner@democompany.com',
        passwordHash,
        name: 'Rajesh Kumar',
        phone: '9876543210',
        role: UserRole.OWNER,
        canCreateInvoice: true,
        canEditInvoice: true,
        canDeleteInvoice: true,
        canViewReports: true,
        canManageCustomers: true,
        canManageProducts: true,
        canManageSettings: true,
      },
    }),
    // Admin
    prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: 'admin@democompany.com' } },
      update: {},
      create: {
        organizationId: organization.id,
        email: 'admin@democompany.com',
        passwordHash,
        name: 'Priya Sharma',
        phone: '9876543211',
        role: UserRole.ADMIN,
        canCreateInvoice: true,
        canEditInvoice: true,
        canDeleteInvoice: true,
        canViewReports: true,
        canManageCustomers: true,
        canManageProducts: true,
        canManageSettings: true,
      },
    }),
    // Accountant
    prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: 'accountant@democompany.com' } },
      update: {},
      create: {
        organizationId: organization.id,
        email: 'accountant@democompany.com',
        passwordHash,
        name: 'Amit Patel',
        phone: '9876543212',
        role: UserRole.ACCOUNTANT,
        canCreateInvoice: true,
        canEditInvoice: true,
        canDeleteInvoice: false,
        canViewReports: true,
        canManageCustomers: true,
        canManageProducts: false,
        canManageSettings: false,
      },
    }),
    // Staff
    prisma.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: 'staff@democompany.com' } },
      update: {},
      create: {
        organizationId: organization.id,
        email: 'staff@democompany.com',
        passwordHash,
        name: 'Neha Gupta',
        phone: '9876543213',
        role: UserRole.STAFF,
        canCreateInvoice: true,
        canEditInvoice: true,
        canDeleteInvoice: false,
        canViewReports: false,
        canManageCustomers: true,
        canManageProducts: true,
        canManageSettings: false,
      },
    }),
  ]);
  console.log(`✅ Created ${users.length} users`);

  // ============================================
  // 3. CREATE TAXES
  // ============================================
  console.log('\n💰 Creating taxes...');
  
  const taxes = await Promise.all([
    prisma.tax.create({
      data: {
        organizationId: organization.id,
        name: 'GST 5%',
        rate: 5,
        taxType: 'GST',
        cgstRate: 2.5,
        sgstRate: 2.5,
        igstRate: 5,
        cessRate: 0,
        isDefault: false,
      },
    }),
    prisma.tax.create({
      data: {
        organizationId: organization.id,
        name: 'GST 12%',
        rate: 12,
        taxType: 'GST',
        cgstRate: 6,
        sgstRate: 6,
        igstRate: 12,
        cessRate: 0,
        isDefault: false,
      },
    }),
    prisma.tax.create({
      data: {
        organizationId: organization.id,
        name: 'GST 18%',
        rate: 18,
        taxType: 'GST',
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 18,
        cessRate: 0,
        isDefault: true,
      },
    }),
    prisma.tax.create({
      data: {
        organizationId: organization.id,
        name: 'GST 28%',
        rate: 28,
        taxType: 'GST',
        cgstRate: 14,
        sgstRate: 14,
        igstRate: 28,
        cessRate: 0,
        isDefault: false,
      },
    }),
  ]);
  console.log(`✅ Created ${taxes.length} tax rates`);

  // ============================================
  // 4. CREATE CUSTOMER GROUPS
  // ============================================
  console.log('\n👥 Creating customer groups...');
  
  const customerGroups = await Promise.all([
    prisma.customerGroup.create({
      data: { organizationId: organization.id, name: 'Retail', description: 'Retail customers' },
    }),
    prisma.customerGroup.create({
      data: { organizationId: organization.id, name: 'Wholesale', description: 'Wholesale buyers' },
    }),
    prisma.customerGroup.create({
      data: { organizationId: organization.id, name: 'VIP', description: 'VIP customers with special pricing' },
    }),
  ]);
  console.log(`✅ Created ${customerGroups.length} customer groups`);

  // ============================================
  // 5. CREATE CUSTOMERS
  // ============================================
  console.log('\n🧑‍💼 Creating customers...');
  
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerType: CustomerType.BUSINESS,
        displayName: 'ABC Electronics Pvt Ltd',
        companyName: 'ABC Electronics Private Limited',
        email: 'purchase@abcelectronics.com',
        phone: '9800000001',
        mobile: '9800000001',
        gstNumber: '29AABCA1234B1ZK',
        gstTreatment: GSTTreatment.REGISTERED_BUSINESS,
        billingAddressLine1: '456 Industrial Area',
        billingCity: 'Bangalore',
        billingState: 'Karnataka',
        billingPostalCode: '560002',
        billingCountry: 'India',
        paymentTerms: 30,
        creditLimit: 500000,
        customerGroupId: customerGroups[1].id, // Wholesale
      },
    }),
    prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerType: CustomerType.BUSINESS,
        displayName: 'XYZ Traders',
        companyName: 'XYZ Trading Company',
        email: 'info@xyztraders.com',
        phone: '9800000002',
        mobile: '9800000002',
        gstNumber: '27AABCX1234C1ZM',
        gstTreatment: GSTTreatment.REGISTERED_BUSINESS,
        billingAddressLine1: '789 Market Road',
        billingCity: 'Mumbai',
        billingState: 'Maharashtra',
        billingPostalCode: '400001',
        billingCountry: 'India',
        paymentTerms: 15,
        creditLimit: 300000,
        customerGroupId: customerGroups[1].id,
      },
    }),
    prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerType: CustomerType.INDIVIDUAL,
        displayName: 'Vikram Singh',
        firstName: 'Vikram',
        lastName: 'Singh',
        email: 'vikram.singh@email.com',
        mobile: '9800000003',
        gstTreatment: GSTTreatment.CONSUMER,
        billingAddressLine1: '12 Residency Road',
        billingCity: 'Bangalore',
        billingState: 'Karnataka',
        billingPostalCode: '560025',
        billingCountry: 'India',
        paymentTerms: 0,
        customerGroupId: customerGroups[0].id, // Retail
      },
    }),
    prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerType: CustomerType.INDIVIDUAL,
        displayName: 'Anita Desai',
        firstName: 'Anita',
        lastName: 'Desai',
        email: 'anita.desai@email.com',
        mobile: '9800000004',
        gstTreatment: GSTTreatment.CONSUMER,
        billingAddressLine1: '45 Green Park',
        billingCity: 'Delhi',
        billingState: 'Delhi',
        billingPostalCode: '110016',
        billingCountry: 'India',
        paymentTerms: 0,
        customerGroupId: customerGroups[2].id, // VIP
      },
    }),
    prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerType: CustomerType.BUSINESS,
        displayName: 'Tech Solutions Ltd',
        companyName: 'Tech Solutions Limited',
        email: 'accounts@techsolutions.com',
        phone: '9800000005',
        mobile: '9800000005',
        gstNumber: '29AABCT5678D1ZN',
        gstTreatment: GSTTreatment.REGISTERED_BUSINESS,
        billingAddressLine1: '100 Tech Park',
        billingCity: 'Hyderabad',
        billingState: 'Telangana',
        billingPostalCode: '500081',
        billingCountry: 'India',
        paymentTerms: 45,
        creditLimit: 1000000,
        customerGroupId: customerGroups[1].id,
      },
    }),
  ]);
  console.log(`✅ Created ${customers.length} customers`);

  // ============================================
  // 6. CREATE PRODUCT CATEGORIES
  // ============================================
  console.log('\n📂 Creating product categories...');
  
  const productCategories = await Promise.all([
    prisma.productCategory.create({
      data: { organizationId: organization.id, name: 'Electronics', description: 'Electronic items and gadgets' },
    }),
    prisma.productCategory.create({
      data: { organizationId: organization.id, name: 'Office Supplies', description: 'Office stationery and supplies' },
    }),
    prisma.productCategory.create({
      data: { organizationId: organization.id, name: 'Furniture', description: 'Office and home furniture' },
    }),
    prisma.productCategory.create({
      data: { organizationId: organization.id, name: 'Services', description: 'Professional services' },
    }),
  ]);
  console.log(`✅ Created ${productCategories.length} product categories`);

  // ============================================
  // 7. CREATE PRODUCTS
  // ============================================
  console.log('\n📦 Creating products...');
  
  const products = await Promise.all([
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Laptop - Dell Inspiron 15',
        sku: 'ELEC-LAP-001',
        type: 'GOODS',
        description: 'Dell Inspiron 15 Laptop, 8GB RAM, 512GB SSD',
        hsnCode: '8471',
        unit: 'PCS',
        sellingPrice: 55000,
        costPrice: 48000,
        taxId: taxes[2].id, // 18% GST
        categoryId: productCategories[0].id,
        trackInventory: true,
        stockQuantity: 25,
        reorderLevel: 5,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Wireless Mouse',
        sku: 'ELEC-MOU-001',
        type: 'GOODS',
        description: 'Logitech Wireless Mouse',
        hsnCode: '8471',
        unit: 'PCS',
        sellingPrice: 1200,
        costPrice: 800,
        taxId: taxes[2].id,
        categoryId: productCategories[0].id,
        trackInventory: true,
        stockQuantity: 100,
        reorderLevel: 20,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'USB Keyboard',
        sku: 'ELEC-KEY-001',
        type: 'GOODS',
        description: 'HP USB Keyboard',
        hsnCode: '8471',
        unit: 'PCS',
        sellingPrice: 800,
        costPrice: 500,
        taxId: taxes[2].id,
        categoryId: productCategories[0].id,
        trackInventory: true,
        stockQuantity: 75,
        reorderLevel: 15,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'A4 Paper (500 sheets)',
        sku: 'OFF-PAP-001',
        type: 'GOODS',
        description: 'A4 size copier paper, 500 sheets',
        hsnCode: '4802',
        unit: 'REAM',
        sellingPrice: 350,
        costPrice: 280,
        taxId: taxes[1].id, // 12% GST
        categoryId: productCategories[1].id,
        trackInventory: true,
        stockQuantity: 200,
        reorderLevel: 50,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Ballpoint Pens (Box of 10)',
        sku: 'OFF-PEN-001',
        type: 'GOODS',
        description: 'Blue ballpoint pens, box of 10',
        hsnCode: '9608',
        unit: 'BOX',
        sellingPrice: 150,
        costPrice: 100,
        taxId: taxes[1].id,
        categoryId: productCategories[1].id,
        trackInventory: true,
        stockQuantity: 150,
        reorderLevel: 30,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Office Chair',
        sku: 'FUR-CHR-001',
        type: 'GOODS',
        description: 'Ergonomic office chair with lumbar support',
        hsnCode: '9401',
        unit: 'PCS',
        sellingPrice: 8500,
        costPrice: 6500,
        taxId: taxes[2].id,
        categoryId: productCategories[2].id,
        trackInventory: true,
        stockQuantity: 30,
        reorderLevel: 5,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Office Desk',
        sku: 'FUR-DSK-001',
        type: 'GOODS',
        description: 'Wooden office desk 5x3 feet',
        hsnCode: '9403',
        unit: 'PCS',
        sellingPrice: 12000,
        costPrice: 9000,
        taxId: taxes[2].id,
        categoryId: productCategories[2].id,
        trackInventory: true,
        stockQuantity: 15,
        reorderLevel: 3,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'IT Support (Hourly)',
        sku: 'SRV-IT-001',
        type: 'SERVICE',
        description: 'Hourly IT support and maintenance',
        sacCode: '998314',
        unit: 'HRS',
        sellingPrice: 1500,
        costPrice: 0,
        taxId: taxes[2].id,
        categoryId: productCategories[3].id,
        trackInventory: false,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Annual Maintenance Contract',
        sku: 'SRV-AMC-001',
        type: 'SERVICE',
        description: 'Annual maintenance contract for IT equipment',
        sacCode: '998714',
        unit: 'YR',
        sellingPrice: 25000,
        costPrice: 0,
        taxId: taxes[2].id,
        categoryId: productCategories[3].id,
        trackInventory: false,
      },
    }),
  ]);
  console.log(`✅ Created ${products.length} products`);

  // ============================================
  // 8. CREATE EXPENSE CATEGORIES
  // ============================================
  console.log('\n💸 Creating expense categories...');
  
  const expenseCategories = await Promise.all([
    prisma.expenseCategory.create({
      data: { organizationId: organization.id, name: 'Office Supplies', description: 'Stationery and office supplies' },
    }),
    prisma.expenseCategory.create({
      data: { organizationId: organization.id, name: 'Travel', description: 'Business travel expenses' },
    }),
    prisma.expenseCategory.create({
      data: { organizationId: organization.id, name: 'Utilities', description: 'Electricity, water, internet' },
    }),
    prisma.expenseCategory.create({
      data: { organizationId: organization.id, name: 'Rent', description: 'Office rent' },
    }),
    prisma.expenseCategory.create({
      data: { organizationId: organization.id, name: 'Salaries', description: 'Employee salaries' },
    }),
    prisma.expenseCategory.create({
      data: { organizationId: organization.id, name: 'Marketing', description: 'Marketing and advertising' },
    }),
  ]);
  console.log(`✅ Created ${expenseCategories.length} expense categories`);

  // ============================================
  // 9. CREATE BANK ACCOUNTS
  // ============================================
  console.log('\n🏦 Creating bank accounts...');
  
  const bankAccounts = await Promise.all([
    prisma.bankAccount.create({
      data: {
        organizationId: organization.id,
        accountName: 'HDFC Current Account',
        accountNumber: '50100123456789',
        bankName: 'HDFC Bank',
        branchName: 'MG Road Branch',
        ifscCode: 'HDFC0001234',
        accountType: 'CURRENT',
        isPrimary: true,
      },
    }),
    prisma.bankAccount.create({
      data: {
        organizationId: organization.id,
        accountName: 'ICICI Savings Account',
        accountNumber: '123456789012',
        bankName: 'ICICI Bank',
        branchName: 'Koramangala Branch',
        ifscCode: 'ICIC0005678',
        accountType: 'SAVINGS',
        isPrimary: false,
      },
    }),
  ]);
  console.log(`✅ Created ${bankAccounts.length} bank accounts`);

  // ============================================
  // 10. CREATE SAMPLE INVOICES
  // ============================================
  console.log('\n📄 Creating sample invoices...');
  
  // Invoice 1 - Paid
  const invoice1 = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      customerId: customers[0].id, // ABC Electronics
      invoiceNumber: 'INV-00001',
      invoiceDate: new Date('2026-01-05'),
      dueDate: new Date('2026-02-04'),
      placeOfSupply: 'Karnataka',
      isInterState: false,
      subtotal: 57000,
      discountType: 'FIXED',
      discountValue: 0,
      discountAmount: 0,
      taxableAmount: 57000,
      cgstAmount: 5130,
      sgstAmount: 5130,
      igstAmount: 0,
      cessAmount: 0,
      totalTax: 10260,
      shippingCharge: 0,
      adjustmentAmount: 0,
      totalAmount: 67260,
      balanceDue: 0,
      status: 'PAID',
      paymentStatus: 'PAID',
      customerNotes: 'Thank you for your business!',
      termsConditions: 'Payment due within 30 days.',
      items: {
        create: [
          {
            productId: products[0].id, // Laptop
            itemType: 'GOODS',
            name: 'Laptop - Dell Inspiron 15',
            description: 'Dell Inspiron 15 Laptop',
            hsnCode: '8471',
            quantity: 1,
            unit: 'PCS',
            rate: 55000,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 55000,
            cgstRate: 9,
            cgstAmount: 4950,
            sgstRate: 9,
            sgstAmount: 4950,
            igstRate: 0,
            igstAmount: 0,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 64900,
          },
          {
            productId: products[1].id, // Mouse
            itemType: 'GOODS',
            name: 'Wireless Mouse',
            hsnCode: '8471',
            quantity: 2,
            unit: 'PCS',
            rate: 1000,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 2000,
            cgstRate: 9,
            cgstAmount: 180,
            sgstRate: 9,
            sgstAmount: 180,
            igstRate: 0,
            igstAmount: 0,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 2360,
          },
        ],
      },
    },
  });

  // Invoice 2 - Partially Paid
  const invoice2 = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      customerId: customers[1].id, // XYZ Traders (Maharashtra - Inter state)
      invoiceNumber: 'INV-00002',
      invoiceDate: new Date('2026-01-10'),
      dueDate: new Date('2026-01-25'),
      placeOfSupply: 'Maharashtra',
      isInterState: true,
      subtotal: 25000,
      discountType: 'PERCENTAGE',
      discountValue: 5,
      discountAmount: 1250,
      taxableAmount: 23750,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 4275,
      cessAmount: 0,
      totalTax: 4275,
      shippingCharge: 500,
      adjustmentAmount: 0,
      totalAmount: 28525,
      balanceDue: 13525,
      status: 'PARTIALLY_PAID',
      paymentStatus: 'PARTIALLY_PAID',
      items: {
        create: [
          {
            productId: products[7].id, // IT Support
            itemType: 'SERVICE',
            name: 'IT Support (Hourly)',
            sacCode: '998314',
            quantity: 10,
            unit: 'HRS',
            rate: 1500,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 15000,
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: 18,
            igstAmount: 2700,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 17700,
          },
          {
            productId: products[5].id, // Office Chair
            itemType: 'GOODS',
            name: 'Office Chair',
            hsnCode: '9401',
            quantity: 1,
            unit: 'PCS',
            rate: 8500,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 8500,
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: 18,
            igstAmount: 1530,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 10030,
          },
        ],
      },
    },
  });

  // Invoice 3 - Overdue
  await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      customerId: customers[4].id, // Tech Solutions
      invoiceNumber: 'INV-00003',
      invoiceDate: new Date('2025-12-01'),
      dueDate: new Date('2026-01-15'),
      placeOfSupply: 'Telangana',
      isInterState: true,
      subtotal: 37000,
      discountType: 'FIXED',
      discountValue: 0,
      discountAmount: 0,
      taxableAmount: 37000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 6660,
      cessAmount: 0,
      totalTax: 6660,
      shippingCharge: 0,
      adjustmentAmount: 0,
      totalAmount: 43660,
      balanceDue: 43660,
      status: 'OVERDUE',
      paymentStatus: 'UNPAID',
      items: {
        create: [
          {
            productId: products[8].id, // AMC
            itemType: 'SERVICE',
            name: 'Annual Maintenance Contract',
            sacCode: '998714',
            quantity: 1,
            unit: 'YR',
            rate: 25000,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 25000,
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: 18,
            igstAmount: 4500,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 29500,
          },
          {
            productId: products[6].id, // Office Desk
            itemType: 'GOODS',
            name: 'Office Desk',
            hsnCode: '9403',
            quantity: 1,
            unit: 'PCS',
            rate: 12000,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 12000,
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: 18,
            igstAmount: 2160,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 14160,
          },
        ],
      },
    },
  });

  // Invoice 4 - Draft
  await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      customerId: customers[2].id, // Vikram Singh
      invoiceNumber: 'INV-00004',
      invoiceDate: new Date('2026-01-18'),
      dueDate: new Date('2026-01-18'),
      placeOfSupply: 'Karnataka',
      isInterState: false,
      subtotal: 2400,
      discountType: 'FIXED',
      discountValue: 0,
      discountAmount: 0,
      taxableAmount: 2400,
      cgstAmount: 144,
      sgstAmount: 144,
      igstAmount: 0,
      cessAmount: 0,
      totalTax: 288,
      shippingCharge: 0,
      adjustmentAmount: 0,
      totalAmount: 2688,
      balanceDue: 2688,
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      items: {
        create: [
          {
            productId: products[3].id, // A4 Paper
            itemType: 'GOODS',
            name: 'A4 Paper (500 sheets)',
            hsnCode: '4802',
            quantity: 5,
            unit: 'REAM',
            rate: 350,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 1750,
            cgstRate: 6,
            cgstAmount: 105,
            sgstRate: 6,
            sgstAmount: 105,
            igstRate: 0,
            igstAmount: 0,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 1960,
          },
          {
            productId: products[4].id, // Pens
            itemType: 'GOODS',
            name: 'Ballpoint Pens (Box of 10)',
            hsnCode: '9608',
            quantity: 3,
            unit: 'BOX',
            rate: 150,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 450,
            cgstRate: 6,
            cgstAmount: 27,
            sgstRate: 6,
            sgstAmount: 27,
            igstRate: 0,
            igstAmount: 0,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 504,
          },
        ],
      },
    },
  });

  console.log('✅ Created 4 sample invoices');

  // ============================================
  // 11. CREATE PAYMENTS
  // ============================================
  console.log('\n💵 Creating payments...');
  
  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      customerId: customers[0].id,
      invoiceId: invoice1.id,
      paymentNumber: 'PAY-00001',
      paymentDate: new Date('2026-01-10'),
      amount: 67260,
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: 'NEFT-123456',
      notes: 'Full payment received',
      unusedAmount: 0,
    },
  });

  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      customerId: customers[1].id,
      invoiceId: invoice2.id,
      paymentNumber: 'PAY-00002',
      paymentDate: new Date('2026-01-15'),
      amount: 15000,
      paymentMode: 'CASH',
      notes: 'Partial payment',
      unusedAmount: 0,
    },
  });

  console.log('✅ Created 2 payments');

  // ============================================
  // 12. CREATE EXPENSES
  // ============================================
  console.log('\n💸 Creating expenses...');
  
  await Promise.all([
    prisma.expense.create({
      data: {
        organizationId: organization.id,
        categoryId: expenseCategories[3].id, // Rent
        expenseDate: new Date('2026-01-01'),
        amount: 50000,
        isTaxInclusive: false,
        taxAmount: 0,
        paymentMode: 'BANK_TRANSFER',
        vendorName: 'Property Owner',
        referenceNumber: 'RENT-JAN-2026',
        notes: 'Office rent for January 2026',
      },
    }),
    prisma.expense.create({
      data: {
        organizationId: organization.id,
        categoryId: expenseCategories[2].id, // Utilities
        expenseDate: new Date('2026-01-05'),
        amount: 5000,
        isTaxInclusive: true,
        taxAmount: 762,
        paymentMode: 'CARD',
        vendorName: 'BESCOM',
        referenceNumber: 'ELEC-JAN-2026',
        notes: 'Electricity bill',
      },
    }),
    prisma.expense.create({
      data: {
        organizationId: organization.id,
        categoryId: expenseCategories[2].id, // Utilities
        expenseDate: new Date('2026-01-10'),
        amount: 2000,
        isTaxInclusive: true,
        taxAmount: 305,
        paymentMode: 'UPI',
        vendorName: 'ACT Fibernet',
        referenceNumber: 'INT-JAN-2026',
        notes: 'Internet bill',
      },
    }),
    prisma.expense.create({
      data: {
        organizationId: organization.id,
        categoryId: expenseCategories[0].id, // Office Supplies
        expenseDate: new Date('2026-01-12'),
        amount: 3500,
        isTaxInclusive: true,
        taxAmount: 534,
        paymentMode: 'CASH',
        vendorName: 'Staples India',
        notes: 'Office stationery',
      },
    }),
  ]);

  console.log('✅ Created 4 expenses');

  // ============================================
  // 13. CREATE ESTIMATES
  // ============================================
  console.log('\n📋 Creating estimates...');
  
  await prisma.estimate.create({
    data: {
      organizationId: organization.id,
      customerId: customers[3].id, // Anita Desai
      estimateNumber: 'EST-00001',
      estimateDate: new Date('2026-01-18'),
      expiryDate: new Date('2026-02-17'),
      placeOfSupply: 'Delhi',
      isInterState: true,
      subtotal: 66500,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      discountAmount: 6650,
      taxableAmount: 59850,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 10773,
      cessAmount: 0,
      totalTax: 10773,
      shippingCharge: 0,
      adjustmentAmount: 0,
      totalAmount: 70623,
      status: 'SENT',
      customerNotes: 'Quote valid for 30 days',
      items: {
        create: [
          {
            productId: products[0].id, // Laptop
            itemType: 'GOODS',
            name: 'Laptop - Dell Inspiron 15',
            hsnCode: '8471',
            quantity: 1,
            unit: 'PCS',
            rate: 55000,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 55000,
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: 18,
            igstAmount: 9900,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 64900,
          },
          {
            productId: products[5].id, // Office Chair
            itemType: 'GOODS',
            name: 'Office Chair',
            hsnCode: '9401',
            quantity: 1,
            unit: 'PCS',
            rate: 8500,
            discountType: 'FIXED',
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: 8500,
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: 18,
            igstAmount: 1530,
            cessRate: 0,
            cessAmount: 0,
            totalAmount: 10030,
          },
        ],
      },
    },
  });

  console.log('✅ Created 1 estimate');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Database seeding completed successfully!');
  console.log('='.repeat(50));
  console.log('\n📊 Summary:');
  console.log(`   • Organization: ${organization.name}`);
  console.log(`   • Users: ${users.length} (Password: Password@123)`);
  console.log(`   • Tax Rates: ${taxes.length}`);
  console.log(`   • Customer Groups: ${customerGroups.length}`);
  console.log(`   • Customers: ${customers.length}`);
  console.log(`   • Product Categories: ${productCategories.length}`);
  console.log(`   • Products: ${products.length}`);
  console.log(`   • Expense Categories: ${expenseCategories.length}`);
  console.log(`   • Bank Accounts: ${bankAccounts.length}`);
  console.log(`   • Invoices: 4`);
  console.log(`   • Payments: 2`);
  console.log(`   • Expenses: 4`);
  console.log(`   • Estimates: 1`);
  console.log('\n🔑 Login Credentials:');
  console.log('   Owner: owner@democompany.com / Password@123');
  console.log('   Admin: admin@democompany.com / Password@123');
  console.log('   Accountant: accountant@democompany.com / Password@123');
  console.log('   Staff: staff@democompany.com / Password@123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
