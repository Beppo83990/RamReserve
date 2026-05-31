import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Resource from './models/Resource.js';
import Reservation from './models/Reservation.js';
import { resources } from './catalog.js';

async function seed() {
  await connectDB(process.env.MONGODB_URI);

  console.log('Clearing existing data...');
  await Promise.all([User.deleteMany({}), Resource.deleteMany({}), Reservation.deleteMany({})]);

  console.log('Seeding resources...');
  await Resource.insertMany(resources);

  console.log('Seeding accounts...');
  const admin = new User({ name: 'System Admin', email: 'admin@reserve.test', role: 'admin' });
  await admin.setPassword('admin123');
  await admin.save();

  const user = new User({ name: 'Demo User', email: 'user@reserve.test', role: 'user' });
  await user.setPassword('user123');
  await user.save();

  console.log('\nSeed complete!');
  console.log('  Admin -> admin@reserve.test / admin123');
  console.log('  User  -> user@reserve.test / user123');
  console.log(`  Resources seeded: ${resources.length}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
