import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';
delete process.env.OPENAI_API_KEY;

const { createApp } = await import('../src/app.js');
const { seedProducts } = await import('../src/services/seeder.js');
const { tick, priceEvents } = await import('../src/services/priceTracker.js');
const { setAIClient } = await import('../src/services/ai.js');
const { default: Product } = await import('../src/models/Product.js');

let mongo;
const app = createApp();

async function registerAndLogin(email = 'jad@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Jad', email, password: 'supersecret1' })
    .expect(201);
  return res.body.token;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await seedProducts();
  setAIClient(null);
});

describe('auth', () => {
  it('registers, logs in and returns the current user', async () => {
    const token = await registerAndLogin();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'JAD@example.com', password: 'supersecret1' })
      .expect(200);
    assert.ok(login.body.token);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    assert.equal(me.body.user.email, 'jad@example.com');
    assert.equal(me.body.user.passwordHash, undefined);
  });

  it('rejects duplicate emails, weak passwords and bad credentials', async () => {
    await registerAndLogin();
    await request(app).post('/api/auth/register').send({ name: 'X', email: 'jad@example.com', password: 'supersecret1' }).expect(409);
    await request(app).post('/api/auth/register').send({ name: 'X', email: 'x@example.com', password: 'short' }).expect(400);
    await request(app).post('/api/auth/login').send({ email: 'jad@example.com', password: 'wrong-password' }).expect(401);
  });

  it('protects list routes', async () => {
    await request(app).get('/api/lists').expect(401);
    await request(app).get('/api/lists').set('Authorization', 'Bearer nope').expect(401);
  });
});

describe('natural-language product search', () => {
  it('parses price limits and categories from the query', async () => {
    const res = await request(app).get('/api/products').query({ q: 'healthy snacks under $5' }).expect(200);
    assert.equal(res.body.filters.maxPrice, 5);
    assert.equal(res.body.filters.category, 'Snacks');
    assert.ok(res.body.products.length > 0);
    for (const p of res.body.products) {
      assert.equal(p.category, 'Snacks');
      assert.ok(p.price <= 5);
    }
    assert.equal(res.body.products[0].name, 'Granola Bars');
  });

  it('uses the OpenAI client when one is configured', async () => {
    setAIClient({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify({ keywords: ['pasta'], category: null, minPrice: null, maxPrice: 2 }) } }],
          }),
        },
      },
    });
    const res = await request(app).get('/api/products').query({ q: 'cheap stuff for pasta night' }).expect(200);
    assert.deepEqual(res.body.products.map((p) => p.name), ['Garlic', 'Spaghetti']);
  });
});

describe('shopping lists', () => {
  it('generates a list from a prompt and links items to products', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post('/api/lists/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'taco night' })
      .expect(201);
    const { list } = res.body;
    assert.ok(list.items.length >= 3);
    assert.ok(list.items.every((i) => i.product));
    assert.ok(list.estimatedTotal > 0);
  });

  it('adds, checks and removes items, scoped to the owner', async () => {
    const token = await registerAndLogin();
    const other = await registerAndLogin('other@example.com');
    const created = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Weekly', items: [{ name: 'eggs', quantity: 2 }] })
      .expect(201);
    const id = created.body.list._id;
    assert.equal(created.body.list.items[0].product.name, 'Eggs');
    assert.equal(created.body.list.estimatedTotal, 6.8);

    const added = await request(app)
      .post(`/api/lists/${id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'unicorn dust' })
      .expect(201);
    const unknown = added.body.list.items[1];
    assert.equal(unknown.product, null);

    const checked = await request(app)
      .patch(`/api/lists/${id}/items/${unknown._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checked: true })
      .expect(200);
    assert.equal(checked.body.list.items[1].checked, true);

    await request(app).get(`/api/lists/${id}`).set('Authorization', `Bearer ${other}`).expect(404);

    const removed = await request(app)
      .delete(`/api/lists/${id}/items/${unknown._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(removed.body.list.items.length, 1);

    await request(app).delete(`/api/lists/${id}`).set('Authorization', `Bearer ${token}`).expect(204);
  });

  it('recommends products related to what the user buys', async () => {
    const token = await registerAndLogin();
    await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Breakfast', items: [{ name: 'Rolled Oats' }, { name: 'Bananas' }] })
      .expect(201);
    const res = await request(app).get('/api/products/recommendations').set('Authorization', `Bearer ${token}`).expect(200);
    const names = res.body.recommendations.map((r) => r.product.name);
    assert.ok(names.length > 0);
    assert.ok(!names.includes('Rolled Oats'));
    assert.ok(!names.includes('Bananas'));
  });
});

describe('price tracking', () => {
  it('updates prices within the allowed band, records history and emits events', async () => {
    const events = [];
    const listener = (u) => events.push(...u);
    priceEvents.on('update', listener);
    let r = 0;
    const updates = await tick({ sampleSize: 50, rand: () => (r++ % 2 ? 1 : 0) });
    priceEvents.off('update', listener);

    assert.ok(updates.length > 0);
    assert.equal(events.length, updates.length);
    for (const u of updates) {
      const p = await Product.findById(u.id);
      const base = p.priceHistory[0].price;
      assert.equal(p.price, u.price);
      assert.equal(p.priceHistory.at(-1).price, u.price);
      assert.ok(p.price <= base * 1.3 + 0.01 && p.price >= base * 0.7 - 0.01);
    }

    const detail = await request(app).get(`/api/products/${updates[0].id}`).expect(200);
    assert.equal(detail.body.product.priceHistory.length, 2);
    assert.equal(detail.body.product.previousPrice, updates[0].oldPrice);
  });
});
