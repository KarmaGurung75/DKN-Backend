// dkn-backend/routes/consultants.js
const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/consultants
router.get('/', (req, res) => {
  db.all(
    `SELECT id, name, email, role, office, region
     FROM Consultants
     ORDER BY name`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching consultants', err);
        return res.status(500).json({ error: 'Failed to fetch consultants' });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
