// dkn-backend/routes/workspaces.js
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../authMiddleware');

// All routes here require auth
router.use(authMiddleware);

// GET /api/workspaces
// List all workspaces (project + community), with project name where applicable
router.get('/', (req, res) => {
  const sql = `
    SELECT w.id,
           w.name,
           w.type,
           w.project_id,
           p.name AS projectName
    FROM workspaces w
    LEFT JOIN projects p ON p.id = w.project_id
    ORDER BY w.name
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching workspaces', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(rows);
  });
});

// GET /api/workspaces/mine
// Workspaces where the current consultant is a member
router.get('/mine', (req, res) => {
  const sql = `
    SELECT w.id,
           w.name,
           w.type,
           w.project_id,
           p.name AS projectName
    FROM workspaces w
    JOIN workspace_members m
      ON m.workspace_id = w.id
    LEFT JOIN projects p
      ON p.id = w.project_id
    WHERE m.consultant_id = ?
    ORDER BY w.name
  `;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
      console.error('Error fetching my workspaces', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(rows);
  });
});

// POST /api/workspaces/:id/join
// Ensure the current consultant is a member and return updated member count
router.post('/:id/join', (req, res) => {
  const workspaceId = req.params.id;

  const wsSql = 'SELECT * FROM workspaces WHERE id = ?';
  db.get(wsSql, [workspaceId], (err, ws) => {
    if (err) {
      console.error('Error loading workspace', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!ws) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const insertSql = `
      INSERT OR IGNORE INTO workspace_members (workspace_id, consultant_id)
      VALUES (?, ?)
    `;
    db.run(insertSql, [workspaceId, req.user.id], (err2) => {
      if (err2) {
        console.error('Error joining workspace', err2);
        return res.status(500).json({ message: 'Internal server error' });
      }

      const countSql = `
        SELECT COUNT(*) AS memberCount
        FROM workspace_members
        WHERE workspace_id = ?
      `;
      db.get(countSql, [workspaceId], (err3, row) => {
        if (err3) {
          console.error('Error counting members', err3);
          return res.status(500).json({ message: 'Internal server error' });
        }
        res.json({ success: true, memberCount: row.memberCount });
      });
    });
  });
});

module.exports = router;
