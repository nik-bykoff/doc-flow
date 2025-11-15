/**
 * Search Routes
 * Global search across documents, tasks, courses
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/search - Global search
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      q, // search query
      type, // document, task, course
      course_id,
      limit = 50
    } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const results = {
      documents: [],
      tasks: [],
      courses: []
    };

    const searchTypes = type ? [type] : ['document', 'task', 'course'];

    // Search documents
    if (searchTypes.includes('document')) {
      let docQuery = db('documents')
        .where('is_deleted', false)
        .where(function() {
          // User's own documents
          this.where('author_id', userId)
            // Or documents in courses user is enrolled in
            .orWhereIn('course_id',
              db('course_enrollments')
                .select('course_id')
                .where('user_id', userId)
            );
        })
        .where(function() {
          // Search in title and content
          this.where('title', 'ilike', `%${q}%`)
            .orWhereRaw("to_tsvector('english', content) @@ plainto_tsquery('english', ?)", [q]);
        });

      if (course_id) {
        docQuery = docQuery.where('course_id', course_id);
      }

      results.documents = await docQuery
        .leftJoin('users', 'documents.author_id', 'users.id')
        .select(
          'documents.id',
          'documents.title',
          'documents.doc_type',
          'documents.updated_at',
          'users.email as author_email'
        )
        .limit(parseInt(limit))
        .orderBy('documents.updated_at', 'desc');
    }

    // Search tasks
    if (searchTypes.includes('task')) {
      let taskQuery = db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('courses', 'projects.course_id', 'courses.id')
        .whereIn('courses.id',
          db('course_enrollments')
            .select('course_id')
            .where('user_id', userId)
        )
        .where(function() {
          this.where('tasks.title', 'ilike', `%${q}%`)
            .orWhere('tasks.description', 'ilike', `%${q}%`);
        });

      if (course_id) {
        taskQuery = taskQuery.where('courses.id', course_id);
      }

      results.tasks = await taskQuery
        .select(
          'tasks.id',
          'tasks.title',
          'tasks.task_type',
          'tasks.due_date',
          'tasks.status',
          'projects.name as project_name',
          'courses.code as course_code'
        )
        .limit(parseInt(limit))
        .orderBy('tasks.due_date', 'asc');
    }

    // Search courses
    if (searchTypes.includes('course') && !course_id) {
      let courseQuery = db('courses')
        .where(function() {
          this.where('code', 'ilike', `%${q}%`)
            .orWhere('name', 'ilike', `%${q}%`)
            .orWhere('description', 'ilike', `%${q}%`);
        });

      // For non-admin, only show enrolled courses
      if (req.user.role !== 'admin') {
        courseQuery = courseQuery.whereIn('id',
          db('course_enrollments')
            .select('course_id')
            .where('user_id', userId)
        );
      }

      results.courses = await courseQuery
        .select('id', 'code', 'name', 'semester', 'is_active')
        .limit(parseInt(limit))
        .orderBy('created_at', 'desc');
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
