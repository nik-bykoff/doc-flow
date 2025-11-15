/**
 * Migration: Project Management Features
 * Adds tables for courses, projects, tasks, submissions, comments, files, and permissions
 */

exports.up = async function(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // 1. Add role field to users if not exists (for backward compatibility)
  await knex.schema.alterTable('users', (table) => {
    table.string('first_name');
    table.string('last_name');
    table.string('avatar_url');
    table.boolean('is_active').defaultTo(true);
  });

  // 2. Courses/Project Spaces - Top-level organizational unit
  await knex.schema.createTable('courses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code').notNullable().unique(); // e.g., "CS101"
    table.string('name').notNullable(); // e.g., "Introduction to Programming"
    table.text('description');
    table.uuid('instructor_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('semester'); // e.g., "Fall 2024"
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 3. Course Enrollments - Many-to-many relationship between users and courses
  await knex.schema.createTable('course_enrollments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('course_id').notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('role', ['student', 'teaching_assistant', 'instructor']).defaultTo('student');
    table.timestamps(true, true);
    table.unique(['course_id', 'user_id']);
  });

  // 4. Projects - Subgroups within courses (e.g., Lab Work 1, Lab Work 2)
  await knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description');
    table.uuid('course_id').notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.uuid('folder_id').references('id').inTable('folders').onDelete('SET NULL'); // Link to documentation
    table.integer('order').defaultTo(0); // For sorting
    table.timestamps(true, true);
  });

  // 5. Tasks/Assignments - Individual work items within projects
  await knex.schema.createTable('tasks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title').notNullable();
    table.text('description');
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.enum('task_type', ['assignment', 'lab', 'project', 'reading', 'other']).defaultTo('assignment');
    table.enum('status', ['draft', 'published', 'closed']).defaultTo('draft');
    table.timestamp('due_date');
    table.integer('max_score').defaultTo(100);
    table.boolean('allow_late_submission').defaultTo(false);
    table.timestamps(true, true);
  });

  // 6. Task Assignments - Assign tasks to specific users or groups
  await knex.schema.createTable('task_assignments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    table.uuid('assigned_to').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('status', ['not_started', 'in_progress', 'submitted', 'graded']).defaultTo('not_started');
    table.timestamps(true, true);
    table.unique(['task_id', 'assigned_to']);
  });

  // 7. Submissions - Student work submissions
  await knex.schema.createTable('submissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('content'); // Text content or notes
    table.timestamp('submitted_at');
    table.integer('score'); // Graded score
    table.text('feedback'); // Instructor feedback
    table.uuid('graded_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('graded_at');
    table.integer('attempt_number').defaultTo(1); // Allow multiple submissions
    table.timestamps(true, true);
  });

  // 8. Files - File attachments for documents, submissions, etc.
  await knex.schema.createTable('files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('filename').notNullable();
    table.string('original_filename').notNullable();
    table.string('mime_type');
    table.bigInteger('size'); // File size in bytes
    table.string('storage_path').notNullable(); // Path to file on disk/cloud
    table.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
    table.enum('entity_type', ['document', 'submission', 'task', 'course', 'user']).notNullable();
    table.uuid('entity_id').notNullable(); // ID of the related entity
    table.timestamps(true, true);
  });

  // 9. Comments - Collaborative commenting on documents
  await knex.schema.createTable('comments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('content').notNullable();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('entity_type', ['document', 'submission', 'task']).notNullable();
    table.uuid('entity_id').notNullable(); // ID of the related entity
    table.uuid('parent_id').references('id').inTable('comments').onDelete('CASCADE'); // For threaded comments
    table.boolean('is_resolved').defaultTo(false);
    table.timestamps(true, true);
  });

  // 10. Document Permissions - Fine-grained access control
  await knex.schema.createTable('document_permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('document_id').notNullable().references('id').inTable('documents').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('course_id').references('id').inTable('courses').onDelete('CASCADE'); // Either user or course
    table.enum('permission', ['view', 'comment', 'edit', 'admin']).notNullable();
    table.timestamps(true, true);
    // Ensure either user_id or course_id is set, but not both
    table.check('(user_id IS NOT NULL AND course_id IS NULL) OR (user_id IS NULL AND course_id IS NOT NULL)');
  });

  // 11. Activity Log - Track all changes for audit trail
  await knex.schema.createTable('activity_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.enum('action', ['create', 'update', 'delete', 'view', 'submit', 'grade']).notNullable();
    table.enum('entity_type', ['document', 'folder', 'course', 'project', 'task', 'submission']).notNullable();
    table.uuid('entity_id').notNullable();
    table.jsonb('metadata'); // Additional context (e.g., changed fields)
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 12. Update documents table to add metadata
  await knex.schema.alterTable('documents', (table) => {
    table.enum('doc_type', ['page', 'note']).defaultTo('page');
    table.boolean('is_deleted').defaultTo(false); // Soft delete
    table.integer('view_count').defaultTo(0);
    table.uuid('course_id').references('id').inTable('courses').onDelete('SET NULL');
  });

  // 13. Create indexes for better performance
  await knex.schema.raw(`
    CREATE INDEX idx_documents_title ON documents USING GIN(to_tsvector('english', title));
    CREATE INDEX idx_documents_content ON documents USING GIN(to_tsvector('english', content));
    CREATE INDEX idx_documents_author_id ON documents(author_id);
    CREATE INDEX idx_documents_folder_id ON documents(folder_id);
    CREATE INDEX idx_documents_course_id ON documents(course_id);
    CREATE INDEX idx_folders_parent_id ON folders(parent_id);
    CREATE INDEX idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX idx_submissions_task_id ON submissions(task_id);
    CREATE INDEX idx_submissions_user_id ON submissions(user_id);
    CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
    CREATE INDEX idx_files_entity ON files(entity_type, entity_id);
    CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
    CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
  `);
};

exports.down = async function(knex) {
  // Drop indexes
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_documents_title;
    DROP INDEX IF EXISTS idx_documents_content;
    DROP INDEX IF EXISTS idx_documents_author_id;
    DROP INDEX IF EXISTS idx_documents_folder_id;
    DROP INDEX IF EXISTS idx_documents_course_id;
    DROP INDEX IF EXISTS idx_folders_parent_id;
    DROP INDEX IF EXISTS idx_tasks_project_id;
    DROP INDEX IF EXISTS idx_submissions_task_id;
    DROP INDEX IF EXISTS idx_submissions_user_id;
    DROP INDEX IF EXISTS idx_comments_entity;
    DROP INDEX IF EXISTS idx_files_entity;
    DROP INDEX IF EXISTS idx_activity_log_user_id;
    DROP INDEX IF EXISTS idx_activity_log_entity;
  `);

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('activity_log');
  await knex.schema.dropTableIfExists('document_permissions');
  await knex.schema.dropTableIfExists('comments');
  await knex.schema.dropTableIfExists('files');
  await knex.schema.dropTableIfExists('submissions');
  await knex.schema.dropTableIfExists('task_assignments');
  await knex.schema.dropTableIfExists('tasks');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('course_enrollments');
  await knex.schema.dropTableIfExists('courses');

  // Revert documents table changes
  await knex.schema.alterTable('documents', (table) => {
    table.dropColumn('doc_type');
    table.dropColumn('is_deleted');
    table.dropColumn('view_count');
    table.dropColumn('course_id');
  });

  // Revert users table changes
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('first_name');
    table.dropColumn('last_name');
    table.dropColumn('avatar_url');
    table.dropColumn('is_active');
  });
};
