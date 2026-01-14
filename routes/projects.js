const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/projects
// ?mine=true to only list projects the logged-in consultant works on
router.get('/', (req, res) => {
  const mine = req.query.mine === 'true';
  let sql = `
    SELECT p.id,
           p.name,
           p.status,
           p.sector,
           c.name AS clientName
    FROM projects p
    JOIN clients c ON c.id = p.client_id
  `;
  const params = [];

  if (mine) {
    sql += `
      JOIN consultant_projects cp ON cp.project_id = p.id
      WHERE cp.consultant_id = ?
    `;
    params.push(req.user.id);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching projects', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(rows);
  });
});

module.exports = router;
