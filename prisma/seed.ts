import { executeQuery } from '../src/lib/db';
import { seedDatabase } from '../scripts/seed-data';

async function main() {
  console.log('🌱 Seeding synthetic recruiting demo data...');
  const summary = await seedDatabase(executeQuery);
  console.log(`✅ Ensured ${summary.rows} rows for ${summary.organizationId}`);
}

main().catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
