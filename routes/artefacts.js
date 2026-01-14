const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/artefacts
// Query params: projectId, tagId, status, mine=true
router.get('/', (req, res) => {
  const { projectId, tagId, status, mine } = req.query;
  const conditions = [];
  const params = [];

  let sql = `
    SELECT a.id,
           a.title,
           a.description,
           a.status,
           a.created_on,
           a.review_due_on,
           a.confidentiality,
           a.trust_level,
           a.category,
           a.project_id,
           p.name AS projectName,
           a.workspace_id,
           w.name AS workspaceName,
           c.name AS ownerName,
           GROUP_CONCAT(t.name, ', ') AS tags
    FROM knowledge_artefacts a
    JOIN consultants c ON c.id = a.owner_id
    LEFT JOIN projects p ON p.id = a.project_id
    LEFT JOIN workspaces w ON w.id = a.workspace_id
    LEFT JOIN artefact_tags at ON at.artefact_id = a.id
    LEFT JOIN tags t ON t.id = at.tag_id
  `;

  if (projectId) {
    conditions.push('a.project_id = ?');
    params.push(projectId);
  }
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (mine === 'true') {
    conditions.push('a.owner_id = ?');
    params.push(req.user.id);
  }
  if (tagId) {
    conditions.push(
      'a.id IN (SELECT artefact_id FROM artefact_tags WHERE tag_id = ?)'
    );
    params.push(tagId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += `
    GROUP BY a.id
    ORDER BY a.created_on DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching artefacts', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(rows);
  });
});

// POST /api/artefacts
// Enforces BR3 + BR5; BR4/BR8 handled in governance review.
router.post('/', (req, res) => {
  const {
    title,
    description,
    projectId,
    workspaceId,
    confidentiality,
    category,
    tagIds,
    reviewDueOn
  } = req.body;

  if (!title || !confidentiality || !reviewDueOn) {
    return res.status(400).json({
      message: 'Title, confidentiality and reviewDueOn are required.'
    });
  }

  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return res
      .status(400)
      .json({ message: 'At least one tag is required (BR3).' });
  }

  // BR5 – must be governed by at least one rule with matching category
  const ruleSql = `
    SELECT id FROM governance_rules
    WHERE artefact_category = ?
  `;
  db.all(ruleSql, [category || null], (err, rules) => {
    if (err) {
      console.error('Error looking up governance rules', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!rules || rules.length === 0) {
      return res.status(400).json({
        message:
          'No governance rule exists for this artefact category (BR5). Choose a valid category.'
      });
    }

    const createdOn = new Date().toISOString().slice(0, 10);
    const insertSql = `
      INSERT INTO knowledge_artefacts
        (title, description, status, created_on, review_due_on, confidentiality,
         trust_level, category, owner_id, project_id, workspace_id)
      VALUES (?, ?, 'PendingReview', ?, ?, ?, 'Untrusted', ?, ?, ?, ?)
    `;
    const params = [
      title,
      description || '',
      createdOn,
      reviewDueOn,
      confidentiality,
      category || null,
      req.user.id,
      projectId || null,
      workspaceId || null
    ];

    db.run(insertSql, params, function (err2) {
      if (err2) {
        console.error('Error inserting artefact', err2);
        return res.status(500).json({ message: 'Internal server error' });
      }

      const artefactId = this.lastID;

      const tagSql =
        'INSERT INTO artefact_tags (artefact_id, tag_id) VALUES (?, ?)';
      const tagStmt = db.prepare(tagSql);
      tagIds.forEach((tagId) => {
        tagStmt.run([artefactId, tagId]);
      });
      tagStmt.finalize();

      const linkSql =
        'INSERT INTO artefact_governance_rules (artefact_id, rule_id) VALUES (?, ?)';
      const linkStmt = db.prepare(linkSql);
      rules.forEach((rule) => {
        linkStmt.run([artefactId, rule.id]);
      });
      linkStmt.finalize();

      res
        .status(201)
        .json({ id: artefactId, message: 'Artefact created and pending review.' });
    });
  });
});

module.exports = router;
