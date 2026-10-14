import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, default: 1, min: 1 },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  checked: { type: Boolean, default: false },
});

const shoppingListSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    prompt: { type: String, default: '' },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('ShoppingList', shoppingListSchema);
