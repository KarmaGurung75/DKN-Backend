const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DBSOURCE = path.join(__dirname, 'dkn.db');

const db = new sqlite3.Database(DBSOURCE);

function initDb() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // Regions and offices (BR1)
    db.run(`
      CREATE TABLE IF NOT EXISTS regions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS offices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        region_id INTEGER NOT NULL,
        FOREIGN KEY (region_id) REFERENCES regions(id)
      );
    `);

    // Consultants (acts as users for login)
    db.run(`
      CREATE TABLE IF NOT EXISTS consultants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        office_id INTEGER NOT NULL,
        region_id INTEGER NOT NULL,
        skill_profile TEXT,
        FOREIGN KEY (office_id) REFERENCES offices(id),
        FOREIGN KEY (region_id) REFERENCES regions(id)
      );
    `);

    // Clients and projects (BR2)
    db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sector TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sector TEXT,
        client_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS consultant_projects (
        consultant_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        PRIMARY KEY (consultant_id, project_id),
        FOREIGN KEY (consultant_id) REFERENCES consultants(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `);

    // Workspaces (BR9)
    db.run(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- Project or Community
        project_id INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id INTEGER NOT NULL,
        consultant_id INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, consultant_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (consultant_id) REFERENCES consultants(id)
      );
    `);

    // Tags
    db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT
      );
    `);

    // Knowledge artefacts (BR3, BR4, BR5, BR6, BR7, BR8)
    db.run(`
      CREATE TABLE IF NOT EXISTS knowledge_artefacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL, -- Draft, PendingReview, Trusted, Retired
        created_on TEXT NOT NULL,
        review_due_on TEXT NOT NULL,
        confidentiality TEXT NOT NULL, -- Internal, ClientConfidential, Restricted
        trust_level TEXT NOT NULL, -- Untrusted, Trusted
        category TEXT,
        owner_id INTEGER NOT NULL,
        project_id INTEGER,
        workspace_id INTEGER,
        FOREIGN KEY (owner_id) REFERENCES consultants(id),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS artefact_tags (
        artefact_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (artefact_id, tag_id),
        FOREIGN KEY (artefact_id) REFERENCES knowledge_artefacts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );
    `);

    // Governance rules & coverage (BR5)
    db.run(`
      CREATE TABLE IF NOT EXISTS governance_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        artefact_category TEXT NOT NULL,
        max_review_interval_months INTEGER,
        retention_years INTEGER,
        mandatory_metadata TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS artefact_governance_rules (
        artefact_id INTEGER NOT NULL,
        rule_id INTEGER NOT NULL,
        PRIMARY KEY (artefact_id, rule_id),
        FOREIGN KEY (artefact_id) REFERENCES knowledge_artefacts(id) ON DELETE CASCADE,
        FOREIGN KEY (rule_id) REFERENCES governance_rules(id)
      );
    `);

    // Quality flags (BR6, BR8)
    db.run(`
      CREATE TABLE IF NOT EXISTS quality_flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artefact_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- Duplicate, Outdated, PoorQuality...
        severity TEXT,
        created_on TEXT NOT NULL,
        reference_artefact_id INTEGER,
        FOREIGN KEY (artefact_id) REFERENCES knowledge_artefacts(id) ON DELETE CASCADE,
        FOREIGN KEY (reference_artefact_id) REFERENCES knowledge_artefacts(id)
      );
    `);

    // Recommendations (BR10)
    db.run(`
      CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consultant_id INTEGER NOT NULL,
        artefact_id INTEGER,
        expert_consultant_id INTEGER,
        kind TEXT NOT NULL, -- Artefact, Expert
        score REAL,
        created_on TEXT NOT NULL,
        FOREIGN KEY (consultant_id) REFERENCES consultants(id),
        FOREIGN KEY (artefact_id) REFERENCES knowledge_artefacts(id),
        FOREIGN KEY (expert_consultant_id) REFERENCES consultants(id)
      );
    `);

    // Governance actions (for audit + leaderboard)
    db.run(`
      CREATE TABLE IF NOT EXISTS governance_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artefact_id INTEGER NOT NULL,
        reviewer_id INTEGER NOT NULL,
        action TEXT NOT NULL, -- approve, reject, retire, outdated, duplicate
        comments TEXT,
        created_on TEXT NOT NULL,
        FOREIGN KEY (artefact_id) REFERENCES knowledge_artefacts(id),
        FOREIGN KEY (reviewer_id) REFERENCES consultants(id)
      );
    `);

    // ---------- Seed data ----------
    db.run(`
      INSERT OR IGNORE INTO regions (id, name) VALUES
        (1, 'UK & Ireland'),
        (2, 'EMEA');
    `);

    db.run(`
      INSERT OR IGNORE INTO offices (id, name, region_id) VALUES
        (1, 'London', 1),
        (2, 'Dublin', 1),
        (3, 'Berlin', 2);
    `);

  function logRun(label, sql) {
  return function (err) {
    if (err) {
      console.error(`[DB] ${label} failed:`, err, '\nSQL:', sql);
    }
  };
}

// Example use:
const seedConsultantsSql = `
  INSERT OR IGNORE INTO consultants (id, name, email, password, role, office_id, region_id, skill_profile) VALUES
    (1, 'Alice Wong', 'alice.wong@velion.com', 'password1', 'Consultant', 1, 1, 'Cloud, DevOps'),
    (2, 'Ben Kumar', 'ben.kumar@velion.com', 'password2', 'KnowledgeChampion', 1, 1, 'Data, Analytics'),
    (3, 'Carla Ruiz', 'carla.ruiz@velion.com', 'password3', 'GovCouncil', 3, 2, 'Governance'),
    (4, 'Darren Lee', 'darren.lee@velion.com', 'password4', 'RegionalManager', 2, 1, 'EMEA North');
`;

db.run(seedConsultantsSql, logRun('seed consultants', seedConsultantsSql));


    db.run(`
      INSERT OR IGNORE INTO clients (id, name, sector) VALUES
        (1, 'Acme Retail', 'Retail'),
        (2, 'FinBank', 'Financial Services');
    `);

    db.run(`
      INSERT OR IGNORE INTO projects (id, name, sector, client_id, status) VALUES
        (1, 'Acme E-commerce Modernisation', 'Retail', 1, 'Active'),
        (2, 'FinBank Cloud Migration', 'Financial Services', 2, 'Active');
    `);

    db.run(`
      INSERT OR IGNORE INTO consultant_projects (consultant_id, project_id) VALUES
        (1, 1),
        (1, 2),
        (2, 1);
    `);

    db.run(`
      INSERT OR IGNORE INTO workspaces (id, name, type, project_id) VALUES
        (1, 'Acme E-comm Squad', 'Project', 1),
        (2, 'Cloud Guild', 'Community', NULL);
    `);

    db.run(`
      INSERT OR IGNORE INTO workspace_members (workspace_id, consultant_id) VALUES
        (1, 1),
        (1, 2),
        (2, 1),
        (2, 3);
    `);

    db.run(`
      INSERT OR IGNORE INTO tags (id, name, category) VALUES
        (1, 'Cloud', 'Tech'),
        (2, 'DevOps', 'Practice'),
        (3, 'FinTech', 'Industry');
    `);

    db.run(`
      INSERT OR IGNORE INTO governance_rules (id, name, artefact_category, max_review_interval_months, retention_years, mandatory_metadata) VALUES
        (1, 'Cloud Playbook Standard', 'Cloud', 12, 5, 'title,description,tags,confidentiality,project'),
        (2, 'Client Case Study Standard', 'CaseStudy', 24, 7, 'title,description,client,sector,confidentiality'),
        (3, 'Internal How-To', 'HowTo', 18, 3, 'title,description,tags');
    `);

    // Seed one trusted artefact so the UI isn't empty
    const now = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const reviewDue = nextYear.toISOString().slice(0, 10);

    db.run(
      `
      INSERT OR IGNORE INTO knowledge_artefacts
        (id, title, description, status, created_on, review_due_on, confidentiality,
         trust_level, category, owner_id, project_id, workspace_id)
      VALUES
        (1, 'Cloud Migration Playbook', 'Guidance for cloud migration', 'Trusted',
         ?, ?, 'ClientConfidential', 'Trusted', 'Cloud', 1, 2, 1);
    `,
      [now, reviewDue]
    );

    db.run(`
      INSERT OR IGNORE INTO artefact_tags (artefact_id, tag_id) VALUES
        (1, 1),
        (1, 2);
    `);

    db.run(`
      INSERT OR IGNORE INTO artefact_governance_rules (artefact_id, rule_id) VALUES
        (1, 1);
    `);

    db.run(
      `
      INSERT OR IGNORE INTO governance_actions (id, artefact_id, reviewer_id, action, comments, created_on) VALUES
        (1, 1, 2, 'approve', 'Initial seed trusted content', ?);
    `,
      [now]
    );

    console.log('Database initialised / migrated.');
  });
}

module.exports = {
  db,
  initDb
};
