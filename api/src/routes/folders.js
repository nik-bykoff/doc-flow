/**
 * Folder Routes
 * Handles hierarchical folder organization
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logActivity } = require('../utils/activityLogger');

// GET /api/folders - Get folder tree
router.get('/', auth, async (req, res) => {
  try {
    const { course_id } = req.query;

    // Get all folders (we'll build the tree on the client)
    let query = db('folders')
      .select('folders.*')
      .orderBy('name', 'asc');

    // If course_id provided, filter by course documents
    if (course_id) {
      query = query.where(function() {
        // Folders containing documents from this course
        this.whereIn('id',
          db('documents')
            .select('folder_id')
            .where('course_id', course_id)
            .whereNotNull('folder_id')
        );
      });
    }

    const folders = await query;

    // Build tree structure
    const folderMap = {};
    const rootFolders = [];

    // First pass: create map
    folders.forEach(folder => {
      folderMap[folder.id] = { ...folder, children: [] };
    });

    // Second pass: build tree
    folders.forEach(folder => {
      if (folder.parent_id) {
        if (folderMap[folder.parent_id]) {
          folderMap[folder.parent_id].children.push(folderMap[folder.id]);
        }
      } else {
        rootFolders.push(folderMap[folder.id]);
      }
    });

    res.json({ folders: rootFolders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// GET /api/folders/:id - Get folder with contents
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const folder = await db('folders').where('id', id).first();

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Get child folders
    const children = await db('folders')
      .where('parent_id', id)
      .orderBy('name', 'asc');

    // Get documents in folder (only those user can access)
    const documents = await db('documents')
      .where('folder_id', id)
      .where('is_deleted', false)
      .where(function() {
        this.where('author_id', userId)
          .orWhereIn('course_id',
            db('course_enrollments')
              .select('course_id')
              .where('user_id', userId)
          );
      })
      .select('id', 'title', 'doc_type', 'updated_at', 'author_id')
      .orderBy('updated_at', 'desc');

    res.json({
      ...folder,
      children,
      documents
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    res.status(500).json({ error: 'Failed to fetch folder' });
  }
});

// POST /api/folders - Create folder
router.post('/', auth, validate({
  body: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
    parent_id: { type: 'uuid', required: false }
  }
}), async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    const userId = req.user.id;

    // Verify parent exists if provided
    if (parent_id) {
      const parent = await db('folders').where('id', parent_id).first();
      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }
    }

    const [folder] = await db('folders')
      .insert({ name, parent_id: parent_id || null })
      .returning('*');

    await logActivity(userId, 'create', 'folder', folder.id, { name });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// PUT /api/folders/:id - Update folder
router.put('/:id', auth, validate({
  body: {
    name: { type: 'string', required: false, minLength: 1, maxLength: 255 },
    parent_id: { type: 'uuid', required: false }
  }
}), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id } = req.body;
    const userId = req.user.id;

    // Check folder exists
    const folder = await db('folders').where('id', id).first();
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Prevent moving folder into itself or its descendants
    if (parent_id === id) {
      return res.status(400).json({ error: 'Cannot move folder into itself' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (parent_id !== undefined) updates.parent_id = parent_id;
    updates.updated_at = db.fn.now();

    const [updated] = await db('folders')
      .where('id', id)
      .update(updates)
      .returning('*');

    await logActivity(userId, 'update', 'folder', id, { fields: Object.keys(updates) });

    res.json(updated);
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// DELETE /api/folders/:id - Delete folder
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if folder has children or documents
    const children = await db('folders').where('parent_id', id).first();
    const documents = await db('documents').where('folder_id', id).where('is_deleted', false).first();

    if (children || documents) {
      return res.status(400).json({
        error: 'Cannot delete folder with children or documents. Move or delete them first.'
      });
    }

    await db('folders').where('id', id).delete();

    await logActivity(userId, 'delete', 'folder', id);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

module.exports = router;
