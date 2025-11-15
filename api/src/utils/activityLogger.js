/**
 * Activity Logger Utility
 * Logs user actions for audit trail and analytics
 */

const db = require('../db');

/**
 * Log an activity
 * @param {string} userId - User performing the action
 * @param {string} action - Action type (create, update, delete, view, submit, grade)
 * @param {string} entityType - Type of entity (document, folder, course, etc.)
 * @param {string} entityId - ID of the entity
 * @param {object} metadata - Additional context (optional)
 */
const logActivity = async (userId, action, entityType, entityId, metadata = {}) => {
  try {
    await db('activity_log').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: JSON.stringify(metadata)
    });
  } catch (error) {
    // Log errors but don't fail the request
    console.error('Activity logging error:', error);
  }
};

/**
 * Get activity log for a specific entity
 */
const getEntityActivity = async (entityType, entityId, limit = 50) => {
  try {
    const activities = await db('activity_log')
      .where({
        entity_type: entityType,
        entity_id: entityId
      })
      .join('users', 'activity_log.user_id', 'users.id')
      .select(
        'activity_log.*',
        'users.email as user_email',
        'users.first_name',
        'users.last_name'
      )
      .orderBy('activity_log.created_at', 'desc')
      .limit(limit);

    // Parse metadata JSON
    return activities.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : {}
    }));
  } catch (error) {
    console.error('Error fetching activity:', error);
    return [];
  }
};

/**
 * Get user activity
 */
const getUserActivity = async (userId, limit = 50) => {
  try {
    const activities = await db('activity_log')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit);

    return activities.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : {}
    }));
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return [];
  }
};

/**
 * Get course activity (all entities related to a course)
 */
const getCourseActivity = async (courseId, limit = 100) => {
  try {
    // Get activities for course, projects, tasks, submissions, and course documents
    const activities = await db('activity_log')
      .where(function() {
        // Direct course activities
        this.where(function() {
          this.where('entity_type', 'course')
            .where('entity_id', courseId);
        })
        // Project activities
        .orWhere(function() {
          this.where('entity_type', 'project')
            .whereIn('entity_id',
              db('projects').select('id').where('course_id', courseId)
            );
        })
        // Task activities
        .orWhere(function() {
          this.where('entity_type', 'task')
            .whereIn('entity_id',
              db('tasks')
                .join('projects', 'tasks.project_id', 'projects.id')
                .where('projects.course_id', courseId)
                .select('tasks.id')
            );
        })
        // Submission activities
        .orWhere(function() {
          this.where('entity_type', 'submission')
            .whereIn('entity_id',
              db('submissions')
                .join('tasks', 'submissions.task_id', 'tasks.id')
                .join('projects', 'tasks.project_id', 'projects.id')
                .where('projects.course_id', courseId)
                .select('submissions.id')
            );
        })
        // Document activities
        .orWhere(function() {
          this.where('entity_type', 'document')
            .whereIn('entity_id',
              db('documents').select('id').where('course_id', courseId)
            );
        });
      })
      .join('users', 'activity_log.user_id', 'users.id')
      .select(
        'activity_log.*',
        'users.email as user_email',
        'users.first_name',
        'users.last_name'
      )
      .orderBy('activity_log.created_at', 'desc')
      .limit(limit);

    return activities.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : {}
    }));
  } catch (error) {
    console.error('Error fetching course activity:', error);
    return [];
  }
};

/**
 * Middleware to automatically log view actions
 */
const logViewMiddleware = (entityType) => {
  return (req, res, next) => {
    if (req.user && req.params.id) {
      // Log asynchronously without blocking the request
      setImmediate(() => {
        logActivity(req.user.id, 'view', entityType, req.params.id);
      });
    }
    next();
  };
};

module.exports = {
  logActivity,
  getEntityActivity,
  getUserActivity,
  getCourseActivity,
  logViewMiddleware
};
