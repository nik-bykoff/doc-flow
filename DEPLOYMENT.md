# Deployment Guide - Faculty Project Management System

## Prerequisites

Before deploying the application, ensure you have the following installed:

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git** (for version control)
- **Node.js** (v18+, for local development only)

## Quick Start with Docker

### 1. Clone the Repository

```bash
git clone <repository-url>
cd doc-flow
```

### 2. Environment Configuration

Create environment files for the API service:

```bash
# Create .env file in the api directory
cat > api/.env <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=db
DB_PORT=5432
DB_NAME=docflow
DB_USER=docflow
DB_PASSWORD=your_secure_password_here
JWT_SECRET=your_very_secure_jwt_secret_here_at_least_32_characters
EOF
```

**Important Security Notes:**
- Change `DB_PASSWORD` to a strong, unique password
- Generate a secure `JWT_SECRET` (minimum 32 characters)
- Never commit the `.env` file to version control

### 3. Start the Application

```bash
docker compose up -d
```

This command will:
1. Start PostgreSQL database
2. Run database migrations automatically
3. Start the API server on port 3000
4. Start the frontend on port 5173

### 4. Verify Deployment

Check that all services are running:

```bash
docker compose ps
```

You should see three services running:
- `docflow_db` - PostgreSQL database
- `docflow_api` - Express.js API server
- `docflow_frontend` - Vue.js frontend

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### 6. Create First Admin User

Register a user through the frontend, then manually update their role in the database:

```bash
# Access the database container
docker compose exec db psql -U docflow -d docflow

# Update user role to admin
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';

# Exit
\q
```

## Production Deployment

### Recommended Architecture

```
[Load Balancer/Reverse Proxy (Nginx)]
            |
    [Docker Host]
            |
   +--------+--------+
   |                 |
[API Containers]  [Frontend Container]
   |
[PostgreSQL DB]
```

### Production docker-compose.yml

Create a `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - app-network
    # Do not expose ports externally in production

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db
    networks:
      - app-network
    # Only expose to nginx, not externally
    expose:
      - "3000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: https://your-api-domain.com/api
    restart: always
    networks:
      - app-network
    expose:
      - "80"

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - frontend
    networks:
      - app-network

volumes:
  db_data:

networks:
  app-network:
    driver: bridge
```

### Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3000;
    }

    upstream frontend {
        server frontend:80;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # API endpoints
        location /api/ {
            proxy_pass http://api/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Increase timeout for file uploads
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Frontend
        location / {
            proxy_pass http://frontend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # File upload size limit
        client_max_body_size 50M;
    }
}
```

### SSL Certificates

For production, use Let's Encrypt:

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to ssl directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/key.pem
```

### Deploy to Production

```bash
# Build and start production services
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down
```

## Database Management

### Backup Database

```bash
# Create backup
docker compose exec db pg_dump -U docflow docflow > backup_$(date +%Y%m%d_%H%M%S).sql

# Or with compression
docker compose exec db pg_dump -U docflow docflow | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database

```bash
# Restore from backup
docker compose exec -T db psql -U docflow docflow < backup.sql

# Or from compressed backup
gunzip -c backup.sql.gz | docker compose exec -T db psql -U docflow docflow
```

### Run Migrations

Migrations run automatically on container start. To run manually:

```bash
docker compose exec api npm run migrate
```

### Create New Migration

```bash
docker compose exec api npm run migrate:make migration_name
```

## Monitoring and Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f db
docker compose logs -f frontend
```

### Database Performance

```bash
# Check active connections
docker compose exec db psql -U docflow -d docflow -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker compose exec db psql -U docflow -d docflow -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Resource Usage

```bash
# Docker stats
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## Scaling

### Horizontal Scaling (Multiple API Instances)

Update `docker-compose.prod.yml`:

```yaml
api:
  # ... existing config
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: '1'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

### Database Connection Pooling

Already configured in `api/src/db.js`:

```javascript
pool: {
  min: 2,
  max: 10
}
```

Adjust based on load:
- Small deployment: min: 2, max: 10
- Medium deployment: min: 5, max: 20
- Large deployment: min: 10, max: 50

## Troubleshooting

### Common Issues

**1. Database Connection Failed**

```bash
# Check database is running
docker compose ps db

# Check database logs
docker compose logs db

# Verify credentials in .env file
```

**2. Migration Errors**

```bash
# Check migration status
docker compose exec api npx knex migrate:status

# Rollback last migration
docker compose exec api npx knex migrate:rollback

# Re-run migrations
docker compose exec api npm run migrate
```

**3. Frontend Cannot Connect to API**

- Check `VITE_API_URL` in frontend environment
- Verify CORS settings in `api/src/index.js`
- Check network connectivity between containers

**4. File Upload Errors**

```bash
# Verify uploads directory exists and has correct permissions
docker compose exec api ls -la /app/uploads

# Create directory if missing
docker compose exec api mkdir -p /app/uploads
```

### Health Checks

Monitor application health:

```bash
# API health
curl http://localhost:3000/health

# Database health
docker compose exec db pg_isready -U docflow
```

## Security Best Practices

1. **Never use default passwords**
2. **Keep JWT_SECRET secure and rotate periodically**
3. **Enable HTTPS in production**
4. **Regularly update Docker images**
5. **Implement rate limiting** (TODO in codebase)
6. **Regular database backups**
7. **Monitor logs for suspicious activity**
8. **Use firewall rules to restrict database access**
9. **Implement intrusion detection**
10. **Regular security audits**

## Performance Optimization

1. **Enable PostgreSQL query caching**
2. **Use CDN for static assets**
3. **Implement Redis for session storage** (TODO)
4. **Enable gzip compression in Nginx**
5. **Optimize database indexes** (already implemented)
6. **Monitor and optimize slow queries**
7. **Use connection pooling** (already configured)

## Support and Maintenance

### Regular Maintenance Tasks

- **Daily**: Monitor logs and error rates
- **Weekly**: Review database performance and backup verification
- **Monthly**: Update dependencies and Docker images
- **Quarterly**: Security audit and penetration testing

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker compose down
docker compose up -d --build

# Verify deployment
docker compose ps
curl http://localhost:3000/health
```

## Additional Resources

- API Documentation: `API_DOCUMENTATION.md`
- Development Setup: See main `README.md`
- Database Schema: `api/migrations/`
- Frontend Components: `frontend/src/components/`
