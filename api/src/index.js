require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.raw('select 1+1 as result');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// API Routes
const authRoutes = require('./routes/auth');
const documentsRoutes = require('./routes/documents');
const foldersRoutes = require('./routes/folders');
const coursesRoutes = require('./routes/courses');
const tasksRoutes = require('./routes/tasks');
const submissionsRoutes = require('./routes/submissions');
const searchRoutes = require('./routes/search');
const commentsRoutes = require('./routes/comments');
const filesRoutes = require('./routes/files');

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/files', filesRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
