const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/tags
router.get('/', (req, res) => {
  db.all('SELECT id, name, category FROM tags ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('Error fetching tags', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(rows);
  });
});

module.exports = router;
