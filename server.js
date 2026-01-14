const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { authMiddleware } = require('./authMiddleware');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const tagRoutes = require('./routes/tags');
const artefactRoutes = require('./routes/artefacts');
const workspaceRoutes = require('./routes/workspaces');
const governanceRoutes = require('./routes/governance');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

initDb();

app.use(cors());
app.use(express.json());

// Public route for login
app.use('/api/auth', authRoutes);

// All remaining API routes require authentication
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/tags', authMiddleware, tagRoutes);
app.use('/api/artefacts', authMiddleware, artefactRoutes);
app.use('/api/workspaces', authMiddleware, workspaceRoutes);
app.use('/api/governance', authMiddleware, governanceRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);

app.get('/', (req, res) => {
  res.send('Digital Knowledge Network backend is running.');
});

app.listen(PORT, () => {
  console.log(`DKN backend listening on port ${PORT}`);
});

module.exports = { app };
