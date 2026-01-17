import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@shop.com' },
    update: {},
    create: {
      email: 'admin@shop.com',
      password_hash: hashedPassword,
      name: 'Shop Admin',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create GUEST/Walk-in customer (ID: 1)
  await prisma.customer.upsert({
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
  console.log('✅ Guest customer created (ID: 1)');

  // Create sample regular customers
  await prisma.customer.create({
    data: {
      id: 2,
      name: 'Rajesh Kumar',
      mobile: '9876543210',
      email: 'rajesh@example.com',
      address: '123 MG Road, Bangalore',
    },
  });

  await prisma.customer.create({
    data: {
      id: 3,
      name: 'Priya Sharma',
      mobile: '9876543211',
      email: 'priya@example.com',
      gstNumber: '29ABCDE1234F1Z5',
    },
  });
  console.log('✅ Sample customers created');

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Rice (Basmati)',
        sku: 'RICE-BAS-001',
        description: '1 KG Premium Basmati Rice',
        price: 120.0,
        stockQuantity: 100,
        minStockAlert: 10,
        category: 'Groceries',
        unit: 'KG',
        taxRate: 5.0,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Tata Salt',
        sku: 'SALT-TAT-001',
        description: '1 KG Iodized Salt',
        price: 20.0,
        stockQuantity: 200,
        minStockAlert: 20,
        category: 'Groceries',
        unit: 'KG',
        taxRate: 5.0,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Amul Butter',
        sku: 'BUTTER-AMU-500',
        description: '500g Amul Salted Butter',
        price: 250.0,
        stockQuantity: 50,
        minStockAlert: 5,
        category: 'Dairy',
        unit: 'PCS',
        taxRate: 12.0,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Maggi Noodles',
        sku: 'NOODLES-MAG-001',
        description: '70g Pack',
        price: 12.0,
        stockQuantity: 500,
        minStockAlert: 50,
        category: 'Instant Food',
        unit: 'PCS',
        taxRate: 18.0,
      },
    }),
  ]);
  console.log(`✅ Created ${products.length} products`);

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
