require('dotenv').config();
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'docflow',
    password: process.env.DB_PASSWORD || 'docflow_password',
    database: process.env.DB_NAME || 'docflow'
  },
  pool: { min: 2, max: 10 }
});

module.exports = db;


