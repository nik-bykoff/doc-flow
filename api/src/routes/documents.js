/**
 * Document Routes
 * Handles CRUD operations for documents with permissions
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  canViewDocument,
  canEditDocument,
  canModifyResource
} = require('../middleware/authorize');
const { logActivity, logViewMiddleware } = require('../utils/activityLogger');

// GET /api/documents - List all documents accessible to user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 50,
      folder_id,
      course_id,
      search,
      doc_type,
      author_id
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('documents')
      .where('is_deleted', false)
      .where(function() {
        // User's own documents
        this.where('author_id', userId)
          // Or documents in courses user is enrolled in
          .orWhereIn('course_id',
            db('course_enrollments')
              .select('course_id')
              .where('user_id', userId)
          )
          // Or documents with explicit permissions
          .orWhereIn('id',
            db('document_permissions')
              .select('document_id')
              .where(function() {
                this.where('user_id', userId)
                  .orWhereIn('course_id',
                    db('course_enrollments')
                      .select('course_id')
                      .where('user_id', userId)
                  );
              })
          );
      });

    // Apply filters
    if (folder_id) query = query.where('folder_id', folder_id);
    if (course_id) query = query.where('course_id', course_id);
    if (doc_type) query = query.where('doc_type', doc_type);
    if (author_id) query = query.where('author_id', author_id);

    // Search by title or content
    if (search) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${search}%`)
          .orWhereRaw("to_tsvector('english', content) @@ plainto_tsquery('english', ?)", [search]);
      });
    }

    // Get total count
    const countQuery = query.clone().count('* as count');
    const [{ count }] = await countQuery;

    // Get paginated results
    const documents = await query
      .leftJoin('users', 'documents.author_id', 'users.id')
      .leftJoin('folders', 'documents.folder_id', 'folders.id')
      .select(
        'documents.*',
        'users.email as author_email',
        'users.first_name as author_first_name',
        'users.last_name as author_last_name',
        'folders.name as folder_name'
      )
      .orderBy('documents.updated_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    res.json({
      documents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/documents/:id - Get single document
router.get('/:id', auth, canViewDocument, logViewMiddleware('document'), async (req, res) => {
  try {
    const document = req.document; // Attached by canViewDocument middleware

    // Increment view count
    await db('documents')
      .where('id', document.id)
      .increment('view_count', 1);

    // Get tags
    const tags = await db('tags')
      .join('document_tags', 'tags.id', 'document_tags.tag_id')
      .where('document_tags.document_id', document.id)
      .select('tags.*');

    // Get author info
    const author = await db('users')
      .where('id', document.author_id)
      .select('id', 'email', 'first_name', 'last_name', 'avatar_url')
      .first();

    res.json({
      ...document,
      view_count: document.view_count + 1,
      tags,
      author
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// POST /api/documents - Create new document
router.post('/', auth, validate({
  body: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    content: { type: 'string', required: false },
    folder_id: { type: 'uuid', required: false },
    course_id: { type: 'uuid', required: false },
    doc_type: { type: 'string', required: false, enum: ['page', 'note'] }
  }
}), async (req, res) => {
  try {
    const { title, content = '', folder_id, course_id, doc_type = 'page' } = req.body;
    const userId = req.user.id;

    // Verify folder exists if provided
    if (folder_id) {
      const folder = await db('folders').where('id', folder_id).first();
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    // Verify course exists and user has access if provided
    if (course_id) {
      const enrollment = await db('course_enrollments')
        .where({ course_id, user_id: userId })
        .first();

      if (!enrollment && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'You must be enrolled in the course to create documents in it'
        });
      }
    }

    // Create document
    const [document] = await db('documents')
      .insert({
        title,
        content,
        author_id: userId,
        folder_id: folder_id || null,
        course_id: course_id || null,
        doc_type
      })
      .returning('*');

    // Log activity
    await logActivity(userId, 'create', 'document', document.id, { title });

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// PUT /api/documents/:id - Update document
router.put('/:id', auth, canEditDocument, validate({
  body: {
    title: { type: 'string', required: false, minLength: 1, maxLength: 500 },
    content: { type: 'string', required: false },
    folder_id: { type: 'uuid', required: false },
    doc_type: { type: 'string', required: false, enum: ['page', 'note'] }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, folder_id, doc_type } = req.body;
    const userId = req.user.id;

    // Build update object with only provided fields
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (folder_id !== undefined) updates.folder_id = folder_id;
    if (doc_type !== undefined) updates.doc_type = doc_type;
    updates.updated_at = db.fn.now();

    if (Object.keys(updates).length === 1) { // Only updated_at
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update document
    const [document] = await db('documents')
      .where('id', id)
      .update(updates)
      .returning('*');

    // Log activity
    await logActivity(userId, 'update', 'document', id, {
      fields: Object.keys(updates).filter(k => k !== 'updated_at')
    });

    res.json(document);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:id - Soft delete document
router.delete('/:id', auth, canModifyResource('documents', 'id', 'author_id'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Soft delete
    await db('documents')
      .where('id', id)
      .update({ is_deleted: true, updated_at: db.fn.now() });

    // Log activity
    await logActivity(userId, 'delete', 'document', id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// POST /api/documents/:id/tags - Add tag to document
router.post('/:id/tags', auth, canEditDocument, validate({
  body: {
    tag_name: { type: 'string', required: true, minLength: 1, maxLength: 50 }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const { tag_name } = req.body;

    // Get or create tag
    let [tag] = await db('tags').where('name', tag_name).select('*');

    if (!tag) {
      [tag] = await db('tags').insert({ name: tag_name }).returning('*');
    }

    // Check if tag already associated
    const existing = await db('document_tags')
      .where({ document_id: id, tag_id: tag.id })
      .first();

    if (existing) {
      return res.status(409).json({ error: 'Tag already associated with document' });
    }

    // Create association
    await db('document_tags').insert({
      document_id: id,
      tag_id: tag.id
    });

    res.status(201).json(tag);
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// DELETE /api/documents/:id/tags/:tagId - Remove tag from document
router.delete('/:id/tags/:tagId', auth, canEditDocument, async (req, res) => {
  try {
    const { id, tagId } = req.params;

    await db('document_tags')
      .where({ document_id: id, tag_id: tagId })
      .delete();

    res.json({ message: 'Tag removed successfully' });
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// GET /api/documents/:id/activity - Get document activity log
router.get('/:id/activity', auth, canViewDocument, async (req, res) => {
  try {
    const { id } = req.params;
    const { getEntityActivity } = require('../utils/activityLogger');

    const activities = await getEntityActivity('document', id);

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

module.exports = router;
