/**
 * Task Routes
 * Handles assignments, lab work, and task management
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  canManageCourse,
  isEnrolledInCourse
} = require('../middleware/authorize');
const { logActivity } = require('../utils/activityLogger');

// GET /api/tasks - List all tasks for user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id, project_id, status, task_type } = req.query;

    // Get tasks from courses user is enrolled in
    let query = db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .join('courses', 'projects.course_id', 'courses.id')
      .leftJoin('users as creators', 'tasks.created_by', 'creators.id')
      .whereIn('courses.id',
        db('course_enrollments')
          .select('course_id')
          .where('user_id', userId)
      )
      .select(
        'tasks.*',
        'projects.name as project_name',
        'courses.code as course_code',
        'courses.name as course_name',
        'creators.email as creator_email'
      );

    // Apply filters
    if (course_id) {
      query = query.where('courses.id', course_id);
    }
    if (project_id) {
      query = query.where('projects.id', project_id);
    }
    if (status) {
      query = query.where('tasks.status', status);
    }
    if (task_type) {
      query = query.where('tasks.task_type', task_type);
    }

    const tasks = await query.orderBy('tasks.due_date', 'asc');

    // For each task, get user's assignment status
    for (const task of tasks) {
      const assignment = await db('task_assignments')
        .where({ task_id: task.id, assigned_to: userId })
        .first();

      task.assignment_status = assignment ? assignment.status : 'not_assigned';
      task.assignment_id = assignment ? assignment.id : null;
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id - Get task details
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const task = await db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .join('courses', 'projects.course_id', 'courses.id')
      .leftJoin('users as creators', 'tasks.created_by', 'creators.id')
      .where('tasks.id', id)
      .select(
        'tasks.*',
        'projects.name as project_name',
        'courses.id as course_id',
        'courses.code as course_code',
        'courses.name as course_name',
        'creators.email as creator_email',
        'creators.first_name as creator_first_name',
        'creators.last_name as creator_last_name'
      )
      .first();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user is enrolled in course
    const enrollment = await db('course_enrollments')
      .where({ course_id: task.course_id, user_id: userId })
      .first();

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user's assignment
    const assignment = await db('task_assignments')
      .where({ task_id: id, assigned_to: userId })
      .first();

    task.assignment = assignment;

    // Get user's submission(s)
    const submissions = await db('submissions')
      .where({ task_id: id, user_id: userId })
      .orderBy('attempt_number', 'desc');

    task.submissions = submissions;

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks - Create task (instructors/TAs only)
router.post('/', auth, validate({
  body: {
    project_id: { type: 'uuid', required: true },
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    description: { type: 'string', required: false },
    task_type: { type: 'string', enum: ['assignment', 'lab', 'project', 'reading', 'other'], required: false },
    due_date: { type: 'string', required: false },
    max_score: { type: 'number', min: 0, required: false },
    allow_late_submission: { type: 'boolean', required: false }
  }
}), async (req, res) => {
  try {
    const {
      project_id,
      title,
      description,
      task_type = 'assignment',
      due_date,
      max_score = 100,
      allow_late_submission = false
    } = req.body;
    const userId = req.user.id;

    // Get project and verify permissions
    const project = await db('projects')
      .where('id', project_id)
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user can manage the course
    const enrollment = await db('course_enrollments')
      .where({ course_id: project.course_id, user_id: userId })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only instructors and TAs can create tasks'
      });
    }

    const [task] = await db('tasks')
      .insert({
        project_id,
        title,
        description,
        task_type,
        created_by: userId,
        due_date: due_date || null,
        max_score,
        allow_late_submission,
        status: 'draft'
      })
      .returning('*');

    await logActivity(userId, 'create', 'task', task.id, { title });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', auth, validate({
  body: {
    title: { type: 'string', required: false, minLength: 1, maxLength: 500 },
    description: { type: 'string', required: false },
    task_type: { type: 'string', enum: ['assignment', 'lab', 'project', 'reading', 'other'], required: false },
    status: { type: 'string', enum: ['draft', 'published', 'closed'], required: false },
    due_date: { type: 'string', required: false },
    max_score: { type: 'number', min: 0, required: false },
    allow_late_submission: { type: 'boolean', required: false }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get task and verify permissions
    const task = await db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .where('tasks.id', id)
      .select('tasks.*', 'projects.course_id')
      .first();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check permissions
    const enrollment = await db('course_enrollments')
      .where({ course_id: task.course_id, user_id: userId })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = {};
    const fields = ['title', 'description', 'task_type', 'status', 'due_date', 'max_score', 'allow_late_submission'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    updates.updated_at = db.fn.now();

    const [updated] = await db('tasks')
      .where('id', id)
      .update(updates)
      .returning('*');

    await logActivity(userId, 'update', 'task', id, {
      fields: Object.keys(updates).filter(k => k !== 'updated_at')
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get task and verify permissions
    const task = await db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .where('tasks.id', id)
      .select('tasks.*', 'projects.course_id')
      .first();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const enrollment = await db('course_enrollments')
      .where({ course_id: task.course_id, user_id: userId })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db('tasks').where('id', id).delete();

    await logActivity(userId, 'delete', 'task', id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/tasks/:id/assign - Assign task to students
router.post('/:id/assign', auth, validate({
  body: {
    user_ids: { type: 'array', required: false },
    assign_all: { type: 'boolean', required: false }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const { user_ids, assign_all = false } = req.body;
    const userId = req.user.id;

    // Get task and verify permissions
    const task = await db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .where('tasks.id', id)
      .select('tasks.*', 'projects.course_id')
      .first();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const enrollment = await db('course_enrollments')
      .where({ course_id: task.course_id, user_id: userId })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let targetUserIds = [];

    if (assign_all) {
      // Get all students in course
      const students = await db('course_enrollments')
        .where('course_id', task.course_id)
        .where('role', 'student')
        .select('user_id');

      targetUserIds = students.map(s => s.user_id);
    } else if (user_ids && user_ids.length > 0) {
      targetUserIds = user_ids;
    } else {
      return res.status(400).json({ error: 'Provide user_ids or set assign_all to true' });
    }

    // Create assignments (ignore duplicates)
    const assignments = targetUserIds.map(uid => ({
      task_id: id,
      assigned_to: uid,
      status: 'not_started'
    }));

    await db('task_assignments')
      .insert(assignments)
      .onConflict(['task_id', 'assigned_to'])
      .ignore();

    await logActivity(userId, 'update', 'task', id, {
      action: 'assign',
      count: targetUserIds.length
    });

    res.json({ message: `Task assigned to ${targetUserIds.length} users` });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// GET /api/tasks/:id/submissions - Get all submissions for task (instructors only)
router.get('/:id/submissions', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get task and verify permissions
    const task = await db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .where('tasks.id', id)
      .select('tasks.*', 'projects.course_id')
      .first();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const enrollment = await db('course_enrollments')
      .where({ course_id: task.course_id, user_id: userId })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all submissions for this task
    const submissions = await db('submissions')
      .where('task_id', id)
      .join('users', 'submissions.user_id', 'users.id')
      .leftJoin('users as graders', 'submissions.graded_by', 'graders.id')
      .select(
        'submissions.*',
        'users.email as student_email',
        'users.first_name as student_first_name',
        'users.last_name as student_last_name',
        'graders.email as grader_email'
      )
      .orderBy('submissions.submitted_at', 'desc');

    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

module.exports = router;
