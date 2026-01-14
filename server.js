// server.js
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

// --- CORS configuration (local + deployed frontend) ---
const allowedOrigins = ['http://localhost:3000'];

// On Render, set FRONTEND_ORIGIN to your Netlify URL
// e.g. https://dkn-frontend-example.netlify.app
if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.push(process.env.FRONTEND_ORIGIN);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // allow REST clients / curl (no origin) and our known frontends
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

// -----------------------------------------------------
initDb();

app.use(express.json());

// Public route for login / signup
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
