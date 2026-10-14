// `npm run seed` - resets the product catalog.
import 'dotenv/config';
import mongoose from 'mongoose';
import { seedProducts } from './services/seeder.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartcart';
await mongoose.connect(uri);
const count = await seedProducts({ reset: true });
console.log(`Seeded ${count} products into ${uri}`);
await mongoose.disconnect();
