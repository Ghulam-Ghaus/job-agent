import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...');

  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@jobagent.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!Secure';

  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Super Admin user seeded: ${admin.email} (ID: ${admin.id})`);

  const defaultSettings = [
    {
      key: 'app_config',
      value: {
        appName: 'AI Job & Client Agent',
        version: '0.1.0',
        allowRegistration: false,
        maxConcurrentSearches: 5,
      },
    },
    {
      key: 'notification_preferences',
      value: {
        emailEnabled: false,
        telegramEnabled: false,
        browserEnabled: true,
      },
    },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
      },
    });
  }

  console.log('✅ System settings seeded successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
