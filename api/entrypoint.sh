#!/bin/sh
set -e

# Install deps if node_modules missing
if [ ! -d node_modules ]; then
  npm install
fi

# Wait for DB
until node -e "require('net').createConnection({host: process.env.DB_HOST || 'db', port: parseInt(process.env.DB_PORT || '5432')}, ()=>process.exit(0)).on('error', ()=>process.exit(1))"; do
  echo "Waiting for database..."
  sleep 2
done

# Run migrations
npx knex migrate:latest --knexfile ./knexfile.js

# Start server
npm run dev
