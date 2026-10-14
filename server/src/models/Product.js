import mongoose from 'mongoose';

const pricePointSchema = new mongoose.Schema(
  {
    price: { type: Number, required: true, min: 0 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    unit: { type: String, default: 'each' },
    price: { type: Number, required: true, min: 0 },
    tags: [{ type: String, lowercase: true }],
    priceHistory: { type: [pricePointSchema], default: [] },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', tags: 'text', category: 'text' });

// Keep the history bounded so documents don't grow forever.
export const MAX_HISTORY = 50;

productSchema.methods.setPrice = function setPrice(newPrice) {
  this.price = Math.round(newPrice * 100) / 100;
  this.priceHistory.push({ price: this.price, at: new Date() });
  if (this.priceHistory.length > MAX_HISTORY) {
    this.priceHistory = this.priceHistory.slice(-MAX_HISTORY);
  }
};

export default mongoose.model('Product', productSchema);
