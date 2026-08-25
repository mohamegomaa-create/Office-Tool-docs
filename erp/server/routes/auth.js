const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired, adminOnly } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.active)
    return res.status(401).json({ error: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(user);
});

// Admin: list users
router.get('/users', authRequired, adminOnly, (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY id')
    .all();
  res.json(users);
});

// Admin: create user
router.post('/users', authRequired, adminOnly, (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
      .run(name, email.toLowerCase(), hash, role || 'staff');
    const user = db
      .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json(user);
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Admin: update user (activate/deactivate, role, password)
router.put('/users/:id', authRequired, adminOnly, (req, res) => {
  const { name, role, active, password } = req.body || {};
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  db.prepare(
    `UPDATE users SET
      name = COALESCE(?, name),
      role = COALESCE(?, role),
      active = COALESCE(?, active),
      password = COALESCE(?, password)
     WHERE id = ?`
  ).run(
    name ?? null,
    role ?? null,
    typeof active === 'boolean' ? (active ? 1 : 0) : null,
    password ? bcrypt.hashSync(password, 10) : null,
    req.params.id
  );
  const user = db
    .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?')
    .get(req.params.id);
  res.json(user);
});

module.exports = router;
