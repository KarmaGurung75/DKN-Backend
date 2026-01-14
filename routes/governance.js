const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireRole } = require('../authMiddleware');

const governanceRoles = ['KnowledgeChampion', 'GovCouncil'];

// GET /api/governance/rules
router.get('/rules', requireRole(governanceRoles), (req, res) => {
  const sql = `
    SELECT id,
           name,
           artefact_category,
           max_review_interval_months,
           retention_years,
           mandatory_metadata
    FROM governance_rules
    ORDER BY artefact_category, name
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching rules', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(rows);
  });
});

// GET /api/governance/pending-artefacts
router.get('/pending-artefacts', requireRole(governanceRoles), (req, res) => {
  const sql = `
    SELECT a.id,
           a.title,
           a.description,
           a.status,
           a.confidentiality,
           a.category,
           a.created_on,
           a.review_due_on,
           c.name AS ownerName,
           GROUP_CONCAT(t.name, ', ') AS tags
    FROM knowledge_artefacts a
    JOIN consultants c ON c.id = a.owner_id
    LEFT JOIN artefact_tags at ON at.artefact_id = a.id
    LEFT JOIN tags t ON t.id = at.tag_id
    WHERE a.status = 'PendingReview'
    GROUP BY a.id
    ORDER BY a.created_on ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching pending artefacts', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(rows);
  });
});

// POST /api/governance/artefacts/:id/review
// body: { decision: 'approve' | 'reject' | 'retire' | 'outdated', comments?: string }
router.post(
  '/artefacts/:id/review',
  requireRole(governanceRoles),
  (req, res) => {
    const artefactId = req.params.id;
    const { decision, comments } = req.body;
    const now = new Date().toISOString().slice(0, 10);

    const getSql = 'SELECT * FROM knowledge_artefacts WHERE id = ?';
    db.get(getSql, [artefactId], (err, artefact) => {
      if (err) {
        console.error('Error loading artefact', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      if (!artefact) {
        return res.status(404).json({ message: 'Artefact not found' });
      }

       // NEW: prevent self-approval (and self-governance generally)
  if (artefact.owner_id === req.user.id) {
    return res.status(400).json({
      message: 'Governance independence: reviewers cannot govern their own artefacts.'
    });
  }


      const dupSql = `
        SELECT * FROM quality_flags
        WHERE artefact_id = ? AND type = 'Duplicate'
      `;
      db.all(dupSql, [artefactId], (err2, dupFlags) => {
        if (err2) {
          console.error('Error checking duplicate flags', err2);
          return res.status(500).json({ message: 'Internal server error' });
        }

        let newStatus = artefact.status;
        let trustLevel = artefact.trust_level;

        if (decision === 'approve') {
          // BR4 – Trusted artefacts must be linked to a project or workspace
          if (!artefact.project_id && !artefact.workspace_id) {
            return res.status(400).json({
              message:
                'Cannot approve: artefact not linked to project or workspace (BR4).'
            });
          }
          // BR8 – Duplicates cannot be trusted
          if (dupFlags && dupFlags.length > 0) {
            return res.status(400).json({
              message:
                'Cannot approve: artefact is marked as Duplicate (BR8).'
            });
          }
          newStatus = 'Trusted';
          trustLevel = 'Trusted';
        } else if (decision === 'reject') {
          newStatus = 'Draft';
          trustLevel = 'Untrusted';
        } else if (decision === 'retire') {
          newStatus = 'Retired';
          trustLevel = 'Untrusted';
        } else if (decision === 'outdated') {
          const qSql = `
            INSERT INTO quality_flags (artefact_id, type, severity, created_on)
            VALUES (?, 'Outdated', 'Medium', ?)
          `;
          db.run(qSql, [artefactId, now]);
        } else {
          return res.status(400).json({ message: 'Unsupported decision.' });
        }

        const updateSql = `
          UPDATE knowledge_artefacts
          SET status = ?, trust_level = ?
          WHERE id = ?
        `;
        db.run(updateSql, [newStatus, trustLevel, artefactId], (err3) => {
          if (err3) {
            console.error('Error updating artefact', err3);
            return res.status(500).json({ message: 'Internal server error' });
          }

          const actionSql = `
            INSERT INTO governance_actions (artefact_id, reviewer_id, action, comments, created_on)
            VALUES (?, ?, ?, ?, ?)
          `;
          db.run(
            actionSql,
            [artefactId, req.user.id, decision, comments || '', now],
            (err4) => {
              if (err4) {
                console.error('Error logging governance action', err4);
                return res
                  .status(500)
                  .json({ message: 'Internal server error' });
              }
              res.json({
                success: true,
                status: newStatus,
                trustLevel,
                decision
              });
            }
          );
        });
      });
    });
  }
);

module.exports = router;
