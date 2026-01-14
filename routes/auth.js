// dkn-backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { generateToken, authMiddleware } = require('../authMiddleware');

// POST /api/auth/signup
// For demo: creates a Consultant in London / UK&I region
router.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: 'Name, email and password are required.' });
  }

  const checkSql = 'SELECT id FROM consultants WHERE email = ?';
  db.get(checkSql, [email], (err, existing) => {
    if (err) {
      console.error('Signup error (check)', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (existing) {
      return res
        .status(400)
        .json({ message: 'An account with this email already exists.' });
    }

    // For simplicity: default office_id=1 (London), region_id=1 (UK&I), role=Consultant
    const insertSql = `
      INSERT INTO consultants (name, email, password, role, office_id, region_id, skill_profile)
      VALUES (?, ?, ?, 'Consultant', 1, 1, '')
    `;
    db.run(insertSql, [name, email, password], function (err2) {
      if (err2) {
        console.error('Signup error (insert)', err2);
        return res.status(500).json({ message: 'Internal server error' });
      }

      const getSql = 'SELECT * FROM consultants WHERE id = ?';
      db.get(getSql, [this.lastID], (err3, user) => {
        if (err3 || !user) {
          console.error('Signup error (fetch new user)', err3);
          return res.status(500).json({ message: 'Internal server error' });
        }
        const token = generateToken(user);
        const { password: _pw, ...safeUser } = user;
        res.status(201).json({ token, user: safeUser });
      });
    });
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: 'Email and password are required.' });
  }

  const sql = 'SELECT * FROM consultants WHERE email = ?';
  db.get(sql, [email], (err, user) => {
    if (err) {
      console.error('Login error', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    const { password: _pw, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const sql = `
    SELECT c.id, c.name, c.email, c.role, c.skill_profile,
           c.office_id, o.name AS officeName,
           c.region_id, r.name AS regionName
    FROM consultants c
    JOIN offices o ON o.id = c.office_id
    JOIN regions r ON r.id = c.region_id
    WHERE c.id = ?
  `;
  db.get(sql, [req.user.id], (err, row) => {
    if (err) {
      console.error('Error fetching profile', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Consultant not found' });
    }
    res.json(row);
  });
});

module.exports = router;
