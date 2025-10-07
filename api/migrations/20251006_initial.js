/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.string('role').notNullable().defaultTo('reader');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('folders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.uuid('parent_id').references('folders.id').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('title').notNullable();
    t.text('content').notNullable();
    t.uuid('author_id').references('users.id').onDelete('CASCADE').notNullable();
    t.uuid('folder_id').references('folders.id').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('tags', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable().unique();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('document_tags', (t) => {
    t.uuid('document_id').references('documents.id').onDelete('CASCADE').notNullable();
    t.uuid('tag_id').references('tags.id').onDelete('CASCADE').notNullable();
    t.primary(['document_id', 'tag_id']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('document_tags');
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('folders');
  await knex.schema.dropTableIfExists('users');
};
