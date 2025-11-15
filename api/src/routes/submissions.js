/**
 * Submission Routes
 * Handles student work submissions and grading
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { canGradeSubmission } = require('../middleware/authorize');
const { logActivity } = require('../utils/activityLogger');

// GET /api/submissions/my - Get current user's submissions
router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { task_id, course_id } = req.query;

    let query = db('submissions')
      .where('submissions.user_id', userId)
      .join('tasks', 'submissions.task_id', 'tasks.id')
      .join('projects', 'tasks.project_id', 'projects.id')
      .join('courses', 'projects.course_id', 'courses.id')
      .leftJoin('users as graders', 'submissions.graded_by', 'graders.id')
      .select(
        'submissions.*',
        'tasks.title as task_title',
        'tasks.max_score as task_max_score',
        'projects.name as project_name',
        'courses.code as course_code',
        'courses.name as course_name',
        'graders.email as grader_email'
      );

    if (task_id) {
      query = query.where('tasks.id', task_id);
    }

    if (course_id) {
      query = query.where('courses.id', course_id);
    }

    const submissions = await query.orderBy('submissions.submitted_at', 'desc');

    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/submissions/:id - Get submission details
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const submission = await db('submissions')
      .where('submissions.id', id)
      .join('tasks', 'submissions.task_id', 'tasks.id')
      .join('projects', 'tasks.project_id', 'projects.id')
      .join('courses', 'projects.course_id', 'courses.id')
      .join('users as students', 'submissions.user_id', 'students.id')
      .leftJoin('users as graders', 'submissions.graded_by', 'graders.id')
      .select(
        'submissions.*',
        'tasks.title as task_title',
        'tasks.description as task_description',
        'tasks.max_score as task_max_score',
        'projects.name as project_name',
        'courses.id as course_id',
        'courses.code as course_code',
        'courses.name as course_name',
        'students.email as student_email',
        'students.first_name as student_first_name',
        'students.last_name as student_last_name',
        'graders.email as grader_email',
        'graders.first_name as grader_first_name',
        'graders.last_name as grader_last_name'
      )
      .first();

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check permissions - user must be submitter, instructor, TA, or admin
    const isOwner = submission.user_id === userId;
    const enrollment = await db('course_enrollments')
      .where({ course_id: submission.course_id, user_id: userId })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!isOwner && !enrollment && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get attached files
    const files = await db('files')
      .where({ entity_type: 'submission', entity_id: id })
      .select('*');

    submission.files = files;

    res.json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// POST /api/submissions - Submit work for a task
router.post('/', auth, validate({
  body: {
    task_id: { type: 'uuid', required: true },
    content: { type: 'string', required: false }
  }
}), async (req, res) => {
  try {
    const { task_id, content = '' } = req.body;
    const userId = req.user.id;

    // Get task and verify it exists and user can submit
    const task = await db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .join('courses', 'projects.course_id', 'courses.id')
      .where('tasks.id', task_id)
      .select(
        'tasks.*',
        'projects.course_id',
        'courses.code as course_code'
      )
      .first();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if task is published
    if (task.status !== 'published') {
      return res.status(400).json({ error: 'Task is not published yet' });
    }

    // Check if user is enrolled
    const enrollment = await db('course_enrollments')
      .where({ course_id: task.course_id, user_id: userId })
      .first();

    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Check if task is assigned to user
    const assignment = await db('task_assignments')
      .where({ task_id, assigned_to: userId })
      .first();

    if (!assignment) {
      return res.status(403).json({ error: 'Task is not assigned to you' });
    }

    // Check due date if late submissions not allowed
    if (!task.allow_late_submission && task.due_date) {
      const now = new Date();
      const dueDate = new Date(task.due_date);
      if (now > dueDate) {
        return res.status(400).json({ error: 'Submission deadline has passed' });
      }
    }

    // Get current attempt number
    const [{ count }] = await db('submissions')
      .where({ task_id, user_id: userId })
      .count('* as count');

    const attemptNumber = parseInt(count) + 1;

    // Create submission
    const [submission] = await db('submissions')
      .insert({
        task_id,
        user_id: userId,
        content,
        submitted_at: db.fn.now(),
        attempt_number: attemptNumber
      })
      .returning('*');

    // Update assignment status
    await db('task_assignments')
      .where({ task_id, assigned_to: userId })
      .update({ status: 'submitted' });

    await logActivity(userId, 'submit', 'submission', submission.id, {
      task_id,
      attempt: attemptNumber
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

// PUT /api/submissions/:id - Update submission (before grading)
router.put('/:id', auth, validate({
  body: {
    content: { type: 'string', required: false }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Get submission
    const submission = await db('submissions')
      .where('id', id)
      .first();

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Only owner can update
    if (submission.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Cannot update if already graded
    if (submission.graded_at) {
      return res.status(400).json({ error: 'Cannot update graded submission' });
    }

    const [updated] = await db('submissions')
      .where('id', id)
      .update({
        content,
        updated_at: db.fn.now()
      })
      .returning('*');

    await logActivity(userId, 'update', 'submission', id);

    res.json(updated);
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// POST /api/submissions/:id/grade - Grade a submission
router.post('/:id/grade', auth, canGradeSubmission, validate({
  body: {
    score: { type: 'number', min: 0, required: true },
    feedback: { type: 'string', required: false }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const { score, feedback = '' } = req.body;
    const userId = req.user.id;

    const submission = req.submission; // Attached by middleware

    // Verify score doesn't exceed max
    const task = await db('tasks')
      .where('id', submission.task_id)
      .first();

    if (score > task.max_score) {
      return res.status(400).json({
        error: `Score cannot exceed maximum score of ${task.max_score}`
      });
    }

    // Update submission with grade
    const [graded] = await db('submissions')
      .where('id', id)
      .update({
        score,
        feedback,
        graded_by: userId,
        graded_at: db.fn.now()
      })
      .returning('*');

    // Update assignment status
    await db('task_assignments')
      .where({
        task_id: submission.task_id,
        assigned_to: submission.user_id
      })
      .update({ status: 'graded' });

    await logActivity(userId, 'grade', 'submission', id, { score });

    res.json(graded);
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ error: 'Failed to grade submission' });
  }
});

// DELETE /api/submissions/:id - Delete submission (before grading)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const submission = await db('submissions')
      .where('id', id)
      .first();

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Only owner can delete
    if (submission.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Cannot delete if already graded
    if (submission.graded_at) {
      return res.status(400).json({ error: 'Cannot delete graded submission' });
    }

    await db('submissions').where('id', id).delete();

    // Update assignment status back to in_progress
    await db('task_assignments')
      .where({
        task_id: submission.task_id,
        assigned_to: submission.user_id
      })
      .update({ status: 'in_progress' });

    await logActivity(userId, 'delete', 'submission', id);

    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

module.exports = router;
