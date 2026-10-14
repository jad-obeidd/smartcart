import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { seedProducts } from './services/seeder.js';
import { startPriceTracker } from './services/priceTracker.js';
import { aiEnabled } from './services/ai.js';

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartcart';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
const seeded = await seedProducts();
if (seeded) console.log(`Seeded ${seeded} sample products`);

startPriceTracker();

createApp().listen(PORT, () => {
  console.log(`SmartCart API listening on http://localhost:${PORT}`);
  console.log(aiEnabled() ? 'OpenAI features enabled' : 'OPENAI_API_KEY not set - using rule-based fallbacks');
});
