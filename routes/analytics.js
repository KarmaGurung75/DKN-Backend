const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/analytics/leaderboard
// Optional query: ?regionId=&limit=
router.get('/leaderboard', (req, res) => {
  const { regionId, limit } = req.query;
  const params = [];
  let whereClause = '';

  if (regionId) {
    whereClause = 'WHERE c.region_id = ?';
    params.push(regionId);
  }

  const sql = `
    SELECT
      c.id,
      c.name,
      c.role,
      c.region_id,
      r.name AS regionName,
      c.office_id,
      o.name AS officeName,
      COALESCE(t.trusted_count, 0) AS trusted_count,
      COALESCE(p.pending_count, 0) AS pending_count,
      COALESCE(g.gov_actions, 0) AS governance_actions,
      COALESCE(w.workspace_count, 0) AS workspace_count
    FROM consultants c
    JOIN offices o ON o.id = c.office_id
    JOIN regions r ON r.id = c.region_id
    LEFT JOIN (
      SELECT owner_id AS consultant_id, COUNT(*) AS trusted_count
      FROM knowledge_artefacts
      WHERE trust_level = 'Trusted'
      GROUP BY owner_id
    ) t ON t.consultant_id = c.id
    LEFT JOIN (
      SELECT owner_id AS consultant_id, COUNT(*) AS pending_count
      FROM knowledge_artefacts
      WHERE status = 'PendingReview'
      GROUP BY owner_id
    ) p ON p.consultant_id = c.id
    LEFT JOIN (
      SELECT reviewer_id AS consultant_id, COUNT(*) AS gov_actions
      FROM governance_actions
      GROUP BY reviewer_id
    ) g ON g.consultant_id = c.id
    LEFT JOIN (
      SELECT consultant_id, COUNT(DISTINCT workspace_id) AS workspace_count
      FROM workspace_members
      GROUP BY consultant_id
    ) w ON w.consultant_id = c.id
    ${whereClause}
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error building leaderboard', err);
      return res.status(500).json({ message: 'Internal server error' });
    }

    const enriched = rows.map((row) => {
      const score =
        row.trusted_count * 10 + // strong weight for trusted artefacts
        row.pending_count * 3 + // pipeline contributions
        row.governance_actions * 5 + // curation work
        row.workspace_count * 2; // collaboration

      return { ...row, score };
    });

    enriched.sort((a, b) => b.score - a.score);

    const lim = limit ? parseInt(limit, 10) : null;
    const sliced = lim ? enriched.slice(0, lim) : enriched;

    res.json(sliced);
  });
});

module.exports = router;
