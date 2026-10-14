import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !EMAIL_RE.test(email || '') || (password || '').length < 8) {
      return res.status(400).json({ error: 'Name, a valid email and a password of at least 8 characters are required' });
    }
    if (await User.exists({ email: email.toLowerCase() })) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = email ? await User.findOne({ email: String(email).toLowerCase() }) : null;
    if (!user || !(await user.checkPassword(password || ''))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
