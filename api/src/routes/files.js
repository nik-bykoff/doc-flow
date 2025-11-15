/**
 * File Upload Routes
 * Handles file uploads for documents, submissions, etc.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|7z|mp4|avi|mov/;
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    const mimetype = allowedTypes.test(file.mimetype.split('/')[1]);

    if (mimetype && allowedTypes.test(ext)) {
      return cb(null, true);
    }

    cb(new Error('Invalid file type. Allowed types: images, documents, archives, videos'));
  }
});

// POST /api/files/upload - Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { entity_type, entity_id } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!entity_type || !entity_id) {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'entity_type and entity_id are required' });
    }

    // Validate entity_type
    const validTypes = ['document', 'submission', 'task', 'course', 'user'];
    if (!validTypes.includes(entity_type)) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Invalid entity_type' });
    }

    // TODO: Verify user has permission to upload to this entity

    // Save file record to database
    const [fileRecord] = await db('files')
      .insert({
        filename: req.file.filename,
        original_filename: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
        storage_path: req.file.path,
        uploaded_by: userId,
        entity_type,
        entity_id
      })
      .returning('*');

    res.status(201).json({
      id: fileRecord.id,
      filename: fileRecord.original_filename,
      size: fileRecord.size,
      mime_type: fileRecord.mime_type,
      created_at: fileRecord.created_at
    });
  } catch (error) {
    console.error('Error uploading file:', error);

    // Clean up file if database insert failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/files/:id - Get file info
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const file = await db('files')
      .where('id', id)
      .leftJoin('users', 'files.uploaded_by', 'users.id')
      .select(
        'files.*',
        'users.email as uploader_email'
      )
      .first();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // TODO: Verify user has permission to access this file

    res.json({
      id: file.id,
      filename: file.original_filename,
      size: file.size,
      mime_type: file.mime_type,
      entity_type: file.entity_type,
      entity_id: file.entity_id,
      uploaded_by: file.uploader_email,
      created_at: file.created_at
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// GET /api/files/:id/download - Download file
router.get('/:id/download', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const file = await db('files').where('id', id).first();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // TODO: Verify user has permission to download this file

    // Check if file exists on disk
    try {
      await fs.access(file.storage_path);
    } catch {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Type', file.mime_type);

    // Stream file to response
    res.sendFile(file.storage_path);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// DELETE /api/files/:id - Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const file = await db('files').where('id', id).first();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Only uploader or admin can delete
    if (file.uploaded_by !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete from database
    await db('files').where('id', id).delete();

    // Delete from disk
    try {
      await fs.unlink(file.storage_path);
    } catch (error) {
      console.error('Error deleting file from disk:', error);
      // Continue even if file deletion fails
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET /api/files - List files for an entity
router.get('/', auth, async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;

    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id are required' });
    }

    // TODO: Verify user has permission to view files for this entity

    const files = await db('files')
      .where({ entity_type, entity_id })
      .leftJoin('users', 'files.uploaded_by', 'users.id')
      .select(
        'files.id',
        'files.original_filename as filename',
        'files.mime_type',
        'files.size',
        'files.created_at',
        'users.email as uploader_email'
      )
      .orderBy('files.created_at', 'desc');

    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

module.exports = router;
