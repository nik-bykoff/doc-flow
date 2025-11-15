# Faculty Project Management System - API Documentation

## Overview

This document provides comprehensive documentation for the Faculty Project Management System REST API. The API supports managing courses, projects, tasks, documents, submissions, and more.

## Base URL

```
http://localhost:3000/api
```

## Authentication

All API endpoints (except `/auth/register` and `/auth/login`) require authentication using JWT tokens.

### Headers

```
Authorization: Bearer <jwt_token>
```

## Authentication Endpoints

### Register User

`POST /auth/register`

**Request Body:**
```json
{
  "email": "student@university.edu",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "student@university.edu",
    "role": "reader"
  },
  "token": "jwt_token"
}
```

### Login

`POST /auth/login`

**Request Body:**
```json
{
  "email": "student@university.edu",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "student@university.edu",
    "role": "student"
  },
  "token": "jwt_token"
}
```

### Get Current User

`GET /auth/me`

**Response:**
```json
{
  "id": "uuid",
  "email": "student@university.edu",
  "role": "student",
  "first_name": "John",
  "last_name": "Doe"
}
```

## Document Endpoints

### List Documents

`GET /documents`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50)
- `folder_id` (uuid): Filter by folder
- `course_id` (uuid): Filter by course
- `search` (string): Search in title and content
- `doc_type` (string): Filter by type (page/note)
- `author_id` (uuid): Filter by author

**Response:**
```json
{
  "documents": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

### Get Document

`GET /documents/:id`

### Create Document

`POST /documents`

**Request Body:**
```json
{
  "title": "Lab Work 1 - Introduction",
  "content": "# Lab Work 1\n\nObjective: ...",
  "folder_id": "uuid (optional)",
  "course_id": "uuid (optional)",
  "doc_type": "page"
}
```

### Update Document

`PUT /documents/:id`

### Delete Document

`DELETE /documents/:id`

### Add Tag to Document

`POST /documents/:id/tags`

**Request Body:**
```json
{
  "tag_name": "javascript"
}
```

### Remove Tag from Document

`DELETE /documents/:id/tags/:tagId`

### Get Document Activity Log

`GET /documents/:id/activity`

## Folder Endpoints

### List Folders (Tree Structure)

`GET /folders`

**Query Parameters:**
- `course_id` (uuid): Filter by course

**Response:**
```json
{
  "folders": [
    {
      "id": "uuid",
      "name": "Course Materials",
      "parent_id": null,
      "children": [...]
    }
  ]
}
```

### Get Folder with Contents

`GET /folders/:id`

### Create Folder

`POST /folders`

**Request Body:**
```json
{
  "name": "Lab Work 1",
  "parent_id": "uuid (optional)"
}
```

### Update Folder

`PUT /folders/:id`

### Delete Folder

`DELETE /folders/:id`

## Course Endpoints

### List Courses

`GET /courses`

**Query Parameters:**
- `is_active` (boolean): Filter by active status
- `semester` (string): Filter by semester

### Get Course

`GET /courses/:courseId`

### Create Course

`POST /courses`

**Request Body:**
```json
{
  "code": "CS101",
  "name": "Introduction to Programming",
  "description": "Learn programming fundamentals",
  "semester": "Fall 2024",
  "is_active": true
}
```

**Required Role:** Instructor or Admin

### Update Course

`PUT /courses/:courseId`

**Required Permission:** Course instructor or admin

### Delete Course

`DELETE /courses/:courseId`

**Required Permission:** Course instructor or admin

### Enroll User in Course

`POST /courses/:courseId/enroll`

**Request Body:**
```json
{
  "user_email": "student@university.edu",
  "role": "student"
}
```

**Role Options:** student, teaching_assistant, instructor

### Remove Enrollment

`DELETE /courses/:courseId/enrollments/:enrollmentId`

### List Course Projects

`GET /courses/:courseId/projects`

### Create Project

`POST /courses/:courseId/projects`

**Request Body:**
```json
{
  "name": "Lab Work 1",
  "description": "Backend Development",
  "folder_id": "uuid (optional)",
  "order": 1
}
```

### Get Course Activity Log

`GET /courses/:courseId/activity`

## Task Endpoints

### List Tasks

`GET /tasks`

**Query Parameters:**
- `course_id` (uuid): Filter by course
- `project_id` (uuid): Filter by project
- `status` (string): Filter by status (draft/published/closed)
- `task_type` (string): Filter by type (assignment/lab/project/reading/other)

### Get Task

`GET /tasks/:id`

### Create Task

`POST /tasks`

**Request Body:**
```json
{
  "project_id": "uuid",
  "title": "Implement REST API",
  "description": "Build comprehensive RESTful API with authentication",
  "task_type": "assignment",
  "due_date": "2024-12-31T23:59:59Z",
  "max_score": 100,
  "allow_late_submission": false
}
```

**Required Role:** Instructor or TA

### Update Task

`PUT /tasks/:id`

### Delete Task

`DELETE /tasks/:id`

### Assign Task to Students

`POST /tasks/:id/assign`

**Request Body:**
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "assign_all": false
}
```

Set `assign_all: true` to assign to all students in the course.

### Get Task Submissions

`GET /tasks/:id/submissions`

**Required Role:** Instructor or TA

## Submission Endpoints

### Get My Submissions

`GET /submissions/my`

**Query Parameters:**
- `task_id` (uuid): Filter by task
- `course_id` (uuid): Filter by course

### Get Submission

`GET /submissions/:id`

### Submit Work

`POST /submissions`

**Request Body:**
```json
{
  "task_id": "uuid",
  "content": "My submission content..."
}
```

### Update Submission

`PUT /submissions/:id`

**Note:** Can only update before grading

### Grade Submission

`POST /submissions/:id/grade`

**Request Body:**
```json
{
  "score": 95,
  "feedback": "Excellent work! Minor improvements needed in error handling."
}
```

**Required Role:** Instructor or TA

### Delete Submission

`DELETE /submissions/:id`

**Note:** Can only delete own submission before grading

## Search Endpoint

### Global Search

`GET /search`

**Query Parameters:**
- `q` (string, required): Search query (min 2 characters)
- `type` (string): Filter by type (document/task/course)
- `course_id` (uuid): Filter by course
- `limit` (number): Max results per type (default: 50)

**Response:**
```json
{
  "documents": [...],
  "tasks": [...],
  "courses": [...]
}
```

## Comment Endpoints

### Get Comments

`GET /comments`

**Query Parameters:**
- `entity_type` (string, required): document/task/submission
- `entity_id` (uuid, required): ID of the entity

**Response:** Returns threaded comments

### Create Comment

`POST /comments`

**Request Body:**
```json
{
  "entity_type": "document",
  "entity_id": "uuid",
  "content": "Great documentation!",
  "parent_id": "uuid (optional, for replies)"
}
```

### Update Comment

`PUT /comments/:id`

### Delete Comment

`DELETE /comments/:id`

**Note:** Cascades to replies

### Resolve Comment

`POST /comments/:id/resolve`

## File Upload Endpoints

### Upload File

`POST /files/upload`

**Request:** multipart/form-data

**Form Fields:**
- `file`: The file to upload
- `entity_type`: document/submission/task/course/user
- `entity_id`: UUID of the entity

**Response:**
```json
{
  "id": "uuid",
  "filename": "report.pdf",
  "size": 1024000,
  "mime_type": "application/pdf",
  "created_at": "2024-11-15T10:00:00Z"
}
```

**File Limits:**
- Max size: 50MB
- Allowed types: images, documents, archives, videos

### Get File Info

`GET /files/:id`

### Download File

`GET /files/:id/download`

### Delete File

`DELETE /files/:id`

### List Files for Entity

`GET /files`

**Query Parameters:**
- `entity_type` (string, required)
- `entity_id` (uuid, required)

## User Roles and Permissions

### Role Hierarchy

1. **admin** - Full system access
2. **instructor** - Manage courses, create tasks, grade submissions
3. **teaching_assistant** - Assist with grading and course management
4. **student** - Submit work, view assigned materials
5. **reader** - View-only access

### Role-Based Access Control

- **Courses**: Only instructors and admins can create/update/delete
- **Tasks**: Instructors and TAs can create and manage
- **Grading**: Instructors and TAs can grade submissions
- **Documents**: Authors and course members can view/edit (based on permissions)

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

## Activity Logging

The system automatically logs activities for audit trails. Activity logs can be accessed via:

- `GET /documents/:id/activity` - Document activity
- `GET /courses/:courseId/activity` - Course-wide activity (all related entities)

Activity logs include:
- User who performed the action
- Action type (create, update, delete, view, submit, grade)
- Entity type and ID
- Metadata (changed fields, etc.)
- Timestamp

## Best Practices

1. **Pagination**: Always use pagination for list endpoints to improve performance
2. **Search**: Use full-text search with PostgreSQL's `to_tsvector` for efficient searching
3. **File Uploads**: Attach files to entities after upload using the file ID
4. **Permissions**: The API automatically checks permissions; no need to verify on client
5. **Errors**: Handle all error responses gracefully in your frontend
6. **Activity Logs**: Use activity logs for debugging and audit trails

## Rate Limiting

**TODO**: Implement rate limiting to prevent abuse

Recommended limits:
- Authentication: 5 requests per minute
- File uploads: 10 requests per minute
- Other endpoints: 100 requests per minute

## Security Considerations

1. All passwords are hashed using bcrypt
2. JWT tokens expire after 7 days
3. File uploads are validated for type and size
4. SQL injection prevention via parameterized queries
5. CORS enabled for frontend integration
6. Input validation on all endpoints

## Testing

Use tools like Postman or curl to test API endpoints:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get documents (with token)
curl -X GET http://localhost:3000/api/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
