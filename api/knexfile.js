require('dotenv').config();

/** @type {import('knex').Knex.Config} */
module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'docflow',
    password: process.env.DB_PASSWORD || 'docflow_password',
    database: process.env.DB_NAME || 'docflow'
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations'
  },
  pool: { min: 2, max: 10 }
};


