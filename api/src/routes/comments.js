/**
 * Comment Routes
 * Handles comments on documents, tasks, and submissions
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logActivity } = require('../utils/activityLogger');

// GET /api/comments - Get comments for an entity
router.get('/', auth, validate({
  query: {
    entity_type: { type: 'string', enum: ['document', 'task', 'submission'], required: true },
    entity_id: { type: 'uuid', required: true }
  }
}), async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;

    // TODO: Verify user has access to the entity

    const comments = await db('comments')
      .where({ entity_type, entity_id })
      .join('users', 'comments.user_id', 'users.id')
      .select(
        'comments.*',
        'users.email as user_email',
        'users.first_name',
        'users.last_name',
        'users.avatar_url'
      )
      .orderBy('comments.created_at', 'asc');

    // Build threaded structure
    const commentMap = {};
    const rootComments = [];

    comments.forEach(comment => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    comments.forEach(comment => {
      if (comment.parent_id) {
        if (commentMap[comment.parent_id]) {
          commentMap[comment.parent_id].replies.push(commentMap[comment.id]);
        }
      } else {
        rootComments.push(commentMap[comment.id]);
      }
    });

    res.json({ comments: rootComments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/comments - Create a comment
router.post('/', auth, validate({
  body: {
    entity_type: { type: 'string', enum: ['document', 'task', 'submission'], required: true },
    entity_id: { type: 'uuid', required: true },
    content: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
    parent_id: { type: 'uuid', required: false }
  }
}), async (req, res) => {
  try {
    const { entity_type, entity_id, content, parent_id } = req.body;
    const userId = req.user.id;

    // TODO: Verify user has access to the entity

    // Verify parent exists if provided
    if (parent_id) {
      const parent = await db('comments').where('id', parent_id).first();
      if (!parent) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      if (parent.entity_id !== entity_id || parent.entity_type !== entity_type) {
        return res.status(400).json({ error: 'Parent comment does not belong to this entity' });
      }
    }

    const [comment] = await db('comments')
      .insert({
        entity_type,
        entity_id,
        content,
        user_id: userId,
        parent_id: parent_id || null
      })
      .returning('*');

    // Get user info for response
    const user = await db('users')
      .where('id', userId)
      .select('email as user_email', 'first_name', 'last_name', 'avatar_url')
      .first();

    await logActivity(userId, 'create', entity_type, entity_id, {
      action: 'comment',
      comment_id: comment.id
    });

    res.status(201).json({ ...comment, ...user, replies: [] });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PUT /api/comments/:id - Update comment
router.put('/:id', auth, validate({
  body: {
    content: { type: 'string', required: true, minLength: 1, maxLength: 5000 }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const comment = await db('comments').where('id', id).first();

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only owner or admin can update
    if (comment.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [updated] = await db('comments')
      .where('id', id)
      .update({ content, updated_at: db.fn.now() })
      .returning('*');

    res.json(updated);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /api/comments/:id - Delete comment
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const comment = await db('comments').where('id', id).first();

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only owner or admin can delete
    if (comment.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // This will cascade delete replies
    await db('comments').where('id', id).delete();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// POST /api/comments/:id/resolve - Mark comment as resolved
router.post('/:id/resolve', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const comment = await db('comments').where('id', id).first();

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // TODO: Verify user has permission to resolve (document owner, instructor, etc.)

    const [updated] = await db('comments')
      .where('id', id)
      .update({ is_resolved: true, updated_at: db.fn.now() })
      .returning('*');

    res.json(updated);
  } catch (error) {
    console.error('Error resolving comment:', error);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

module.exports = router;
