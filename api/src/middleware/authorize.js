/**
 * Role-Based Authorization Middleware
 * Provides fine-grained access control based on user roles and permissions
 */

const db = require('../db');

/**
 * Role hierarchy and permissions
 */
const ROLES = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  TEACHING_ASSISTANT: 'teaching_assistant',
  STUDENT: 'student',
  READER: 'reader'
};

const ROLE_HIERARCHY = {
  admin: 5,
  instructor: 4,
  teaching_assistant: 3,
  student: 2,
  reader: 1
};

/**
 * Check if user has required role
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(userRole)) {
      // Also allow if user has a higher role in hierarchy
      const userLevel = ROLE_HIERARCHY[userRole] || 0;
      const allowedLevels = allowedRoles.map(role => ROLE_HIERARCHY[role] || 0);
      const maxAllowedLevel = Math.max(...allowedLevels);

      if (userLevel < maxAllowedLevel) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: userRole
        });
      }
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const requireAdmin = requireRole(ROLES.ADMIN);

/**
 * Check if user is instructor or higher
 */
const requireInstructor = requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN);

/**
 * Check if user can manage course
 * User must be the course instructor, TA, or admin
 */
const canManageCourse = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.course_id;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID required' });
    }

    // Admins can manage any course
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    // Check if user is course instructor
    const course = await db('courses')
      .where('id', courseId)
      .first();

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.instructor_id === userId) {
      return next();
    }

    // Check if user is enrolled as instructor or TA
    const enrollment = await db('course_enrollments')
      .where({
        course_id: courseId,
        user_id: userId
      })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!enrollment) {
      return res.status(403).json({
        error: 'You do not have permission to manage this course'
      });
    }

    next();
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Check if user is enrolled in course
 */
const isEnrolledInCourse = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.course_id;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID required' });
    }

    // Admins can access any course
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    // Check enrollment
    const enrollment = await db('course_enrollments')
      .where({
        course_id: courseId,
        user_id: userId
      })
      .first();

    if (!enrollment) {
      return res.status(403).json({
        error: 'You are not enrolled in this course'
      });
    }

    // Attach enrollment to request
    req.enrollment = enrollment;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Check if user owns resource or is admin
 */
const canModifyResource = (tableName, idField = 'id', ownerField = 'author_id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idField] || req.params.id;
      const userId = req.user.id;

      if (!resourceId) {
        return res.status(400).json({ error: 'Resource ID required' });
      }

      // Admins can modify any resource
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }

      // Check ownership
      const resource = await db(tableName)
        .where('id', resourceId)
        .first();

      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      if (resource[ownerField] !== userId) {
        return res.status(403).json({
          error: 'You do not have permission to modify this resource'
        });
      }

      // Attach resource to request
      req.resource = resource;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

/**
 * Check if user can view document (considering permissions)
 */
const canViewDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id || req.params.documentId;
    const userId = req.user.id;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID required' });
    }

    // Get document
    const document = await db('documents')
      .where('id', documentId)
      .where('is_deleted', false)
      .first();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Admins and document authors can always view
    if (req.user.role === ROLES.ADMIN || document.author_id === userId) {
      req.document = document;
      return next();
    }

    // Check if document has course context
    if (document.course_id) {
      // Check if user is enrolled in the course
      const enrollment = await db('course_enrollments')
        .where({
          course_id: document.course_id,
          user_id: userId
        })
        .first();

      if (enrollment) {
        req.document = document;
        req.enrollment = enrollment;
        return next();
      }
    }

    // Check explicit document permissions
    const permission = await db('document_permissions')
      .where('document_id', documentId)
      .where(function() {
        this.where('user_id', userId)
          .orWhere(function() {
            this.whereIn('course_id',
              db('course_enrollments')
                .select('course_id')
                .where('user_id', userId)
            );
          });
      })
      .first();

    if (!permission) {
      return res.status(403).json({
        error: 'You do not have permission to view this document'
      });
    }

    req.document = document;
    req.permission = permission;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Check if user can edit document
 */
const canEditDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id || req.params.documentId;
    const userId = req.user.id;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID required' });
    }

    // Get document
    const document = await db('documents')
      .where('id', documentId)
      .where('is_deleted', false)
      .first();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Admins and document authors can always edit
    if (req.user.role === ROLES.ADMIN || document.author_id === userId) {
      req.document = document;
      return next();
    }

    // Check permissions for edit access
    const permission = await db('document_permissions')
      .where('document_id', documentId)
      .where(function() {
        this.where('user_id', userId)
          .orWhere(function() {
            this.whereIn('course_id',
              db('course_enrollments')
                .select('course_id')
                .where('user_id', userId)
            );
          });
      })
      .whereIn('permission', ['edit', 'admin'])
      .first();

    if (!permission) {
      return res.status(403).json({
        error: 'You do not have permission to edit this document'
      });
    }

    req.document = document;
    req.permission = permission;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Check if user can grade submissions
 */
const canGradeSubmission = async (req, res, next) => {
  try {
    const submissionId = req.params.id || req.params.submissionId;
    const userId = req.user.id;

    if (!submissionId) {
      return res.status(400).json({ error: 'Submission ID required' });
    }

    // Admins can grade anything
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    // Get submission with task and course info
    const submission = await db('submissions')
      .join('tasks', 'submissions.task_id', 'tasks.id')
      .join('projects', 'tasks.project_id', 'projects.id')
      .join('courses', 'projects.course_id', 'courses.id')
      .where('submissions.id', submissionId)
      .select('submissions.*', 'courses.id as course_id', 'courses.instructor_id')
      .first();

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if user is course instructor
    if (submission.instructor_id === userId) {
      req.submission = submission;
      return next();
    }

    // Check if user is enrolled as instructor or TA
    const enrollment = await db('course_enrollments')
      .where({
        course_id: submission.course_id,
        user_id: userId
      })
      .whereIn('role', ['instructor', 'teaching_assistant'])
      .first();

    if (!enrollment) {
      return res.status(403).json({
        error: 'You do not have permission to grade this submission'
      });
    }

    req.submission = submission;
    req.enrollment = enrollment;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  requireRole,
  requireAdmin,
  requireInstructor,
  canManageCourse,
  isEnrolledInCourse,
  canModifyResource,
  canViewDocument,
  canEditDocument,
  canGradeSubmission
};
