/**
 * Course Routes
 * Handles course management, enrollments, and project spaces
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  requireInstructor,
  canManageCourse,
  isEnrolledInCourse
} = require('../middleware/authorize');
const { logActivity, getCourseActivity } = require('../utils/activityLogger');

// GET /api/courses - List all courses (enrolled or public)
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_active, semester } = req.query;

    let query = db('courses')
      .leftJoin('users', 'courses.instructor_id', 'users.id')
      .select(
        'courses.*',
        'users.email as instructor_email',
        'users.first_name as instructor_first_name',
        'users.last_name as instructor_last_name'
      );

    // Apply filters
    if (is_active !== undefined) {
      query = query.where('courses.is_active', is_active === 'true');
    }
    if (semester) {
      query = query.where('courses.semester', semester);
    }

    // For non-admin users, only show courses they're enrolled in
    if (req.user.role !== 'admin') {
      query = query.whereIn('courses.id',
        db('course_enrollments')
          .select('course_id')
          .where('user_id', userId)
      );
    }

    const courses = await query.orderBy('courses.created_at', 'desc');

    // Get enrollment counts for each course
    for (const course of courses) {
      const [{ count }] = await db('course_enrollments')
        .where('course_id', course.id)
        .count('* as count');
      course.enrollment_count = parseInt(count);
    }

    res.json({ courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /api/courses/:courseId - Get course details
router.get('/:courseId', auth, isEnrolledInCourse, async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await db('courses')
      .leftJoin('users', 'courses.instructor_id', 'users.id')
      .where('courses.id', courseId)
      .select(
        'courses.*',
        'users.email as instructor_email',
        'users.first_name as instructor_first_name',
        'users.last_name as instructor_last_name'
      )
      .first();

    // Get enrollments
    const enrollments = await db('course_enrollments')
      .where('course_id', courseId)
      .join('users', 'course_enrollments.user_id', 'users.id')
      .select(
        'course_enrollments.*',
        'users.email',
        'users.first_name',
        'users.last_name'
      )
      .orderBy('course_enrollments.role', 'desc')
      .orderBy('users.last_name', 'asc');

    // Get projects
    const projects = await db('projects')
      .where('course_id', courseId)
      .orderBy('order', 'asc')
      .orderBy('created_at', 'asc');

    res.json({
      ...course,
      enrollments,
      projects
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// POST /api/courses - Create course (instructors and admins only)
router.post('/', auth, requireInstructor, validate({
  body: {
    code: { type: 'string', required: true, minLength: 1, maxLength: 20 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
    description: { type: 'string', required: false },
    semester: { type: 'string', required: false, maxLength: 50 },
    is_active: { type: 'boolean', required: false }
  }
}), async (req, res) => {
  try {
    const { code, name, description, semester, is_active = true } = req.body;
    const userId = req.user.id;

    // Check if code already exists
    const existing = await db('courses').where('code', code).first();
    if (existing) {
      return res.status(409).json({ error: 'Course code already exists' });
    }

    const [course] = await db('courses')
      .insert({
        code,
        name,
        description,
        instructor_id: userId,
        semester,
        is_active
      })
      .returning('*');

    // Auto-enroll creator as instructor
    await db('course_enrollments').insert({
      course_id: course.id,
      user_id: userId,
      role: 'instructor'
    });

    await logActivity(userId, 'create', 'course', course.id, { code, name });

    res.status(201).json(course);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PUT /api/courses/:courseId - Update course
router.put('/:courseId', auth, canManageCourse, validate({
  body: {
    code: { type: 'string', required: false, minLength: 1, maxLength: 20 },
    name: { type: 'string', required: false, minLength: 1, maxLength: 255 },
    description: { type: 'string', required: false },
    semester: { type: 'string', required: false, maxLength: 50 },
    is_active: { type: 'boolean', required: false }
  }
}), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { code, name, description, semester, is_active } = req.body;
    const userId = req.user.id;

    const updates = {};
    if (code !== undefined) updates.code = code;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (semester !== undefined) updates.semester = semester;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = db.fn.now();

    const [course] = await db('courses')
      .where('id', courseId)
      .update(updates)
      .returning('*');

    await logActivity(userId, 'update', 'course', courseId, {
      fields: Object.keys(updates).filter(k => k !== 'updated_at')
    });

    res.json(course);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// DELETE /api/courses/:courseId - Delete course
router.delete('/:courseId', auth, canManageCourse, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // This will cascade delete enrollments, projects, tasks, etc.
    await db('courses').where('id', courseId).delete();

    await logActivity(userId, 'delete', 'course', courseId);

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// POST /api/courses/:courseId/enroll - Enroll user in course
router.post('/:courseId/enroll', auth, canManageCourse, validate({
  body: {
    user_email: { type: 'string', email: true, required: true },
    role: { type: 'string', enum: ['student', 'teaching_assistant', 'instructor'], required: false }
  }
}), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { user_email, role = 'student' } = req.body;
    const adminId = req.user.id;

    // Find user by email
    const user = await db('users').where('email', user_email).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already enrolled
    const existing = await db('course_enrollments')
      .where({ course_id: courseId, user_id: user.id })
      .first();

    if (existing) {
      return res.status(409).json({ error: 'User already enrolled in course' });
    }

    const [enrollment] = await db('course_enrollments')
      .insert({
        course_id: courseId,
        user_id: user.id,
        role
      })
      .returning('*');

    await logActivity(adminId, 'create', 'course', courseId, {
      action: 'enroll_user',
      user_id: user.id,
      role
    });

    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Error enrolling user:', error);
    res.status(500).json({ error: 'Failed to enroll user' });
  }
});

// DELETE /api/courses/:courseId/enrollments/:enrollmentId - Remove enrollment
router.delete('/:courseId/enrollments/:enrollmentId', auth, canManageCourse, async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;

    await db('course_enrollments').where('id', enrollmentId).delete();

    await logActivity(userId, 'delete', 'course', req.params.courseId, {
      action: 'remove_enrollment',
      enrollment_id: enrollmentId
    });

    res.json({ message: 'Enrollment removed successfully' });
  } catch (error) {
    console.error('Error removing enrollment:', error);
    res.status(500).json({ error: 'Failed to remove enrollment' });
  }
});

// GET /api/courses/:courseId/projects - Get course projects
router.get('/:courseId/projects', auth, isEnrolledInCourse, async (req, res) => {
  try {
    const { courseId } = req.params;

    const projects = await db('projects')
      .where('course_id', courseId)
      .orderBy('order', 'asc')
      .orderBy('created_at', 'asc');

    // Get task counts for each project
    for (const project of projects) {
      const [{ count }] = await db('tasks')
        .where('project_id', project.id)
        .count('* as count');
      project.task_count = parseInt(count);
    }

    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/courses/:courseId/projects - Create project
router.post('/:courseId/projects', auth, canManageCourse, validate({
  body: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
    description: { type: 'string', required: false },
    folder_id: { type: 'uuid', required: false },
    order: { type: 'number', required: false, min: 0 }
  }
}), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { name, description, folder_id, order = 0 } = req.body;
    const userId = req.user.id;

    const [project] = await db('projects')
      .insert({
        name,
        description,
        course_id: courseId,
        folder_id: folder_id || null,
        order
      })
      .returning('*');

    await logActivity(userId, 'create', 'project', project.id, { name });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/courses/:courseId/activity - Get course activity log
router.get('/:courseId/activity', auth, isEnrolledInCourse, async (req, res) => {
  try {
    const { courseId } = req.params;

    const activities = await getCourseActivity(courseId);

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

module.exports = router;
