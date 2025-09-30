# Technical Specification
## Project: DocFlow – Knowledge Management System

### 1. Project Goal
Develop a corporate documentation and notes management system with support for tags, folders, and basic integrations.

---

### 2. Main User Roles
1. **Administrator**
   - Manages users and roles.
   - Configures access structure.
   - Controls integrations.

2. **Editor**
   - Creates and edits documents.
   - Organizes content in folders and tags.

3. **Reader**
   - Has access to view documents.
   - Uses search and navigation.

---

### 3. Functional Requirements
#### 3.1 Document Management
- Creation of two types of documents:
  - Regular page (Markdown/HTML editor).
  - Note (quick creation of short entries).
- Organization of documents into:
  - Tags (ability to add multiple tags to a document).
  - Folder structure (analogous to file system).
- Search for documents by:
  - Title.
  - Tags.
  - Author.

#### 3.2 Users and Access Rights
- Registration and authorization (email + password).
- Roles: administrator, editor, reader.
- Access to documents according to role.

#### 3.3 Integrations
- Support for Dropbox integration for file storage (minimum – connection via API).

#### 3.4 Interface
- Modern web interface.
- Minimalist design with theme support (light/dark).
- Drag&Drop for uploading files to documents.

---

### 4. Non-Functional Requirements
- The system must be accessible via web browser.
- Performance: search and document loading no more than 1 second with 10,000 documents.
- Security: password storage in hashed form (bcrypt/argon2).
- Scalability: containerization support (Docker).
- API for integrations: REST and basic GraphQL.

---

### 5. Architecture
- **Frontend**: VueJS (SPA, Markdown editor support).
- **Backend**: NodeJS (NestJS or Express).
- **Database**: PostgreSQL (storage of documents and users).
- **File storage**: Dropbox integration.
- **Hosting**: Docker, preparation for Kubernetes.
- **Authentication**: JWT tokens.

---


### 6. Implementation Stages (MVP, 8 weeks)

#### Week 1
- Development environment setup (Frontend + Backend).
- Creation of basic database structure (users, documents, tags, folders).
- User registration and authorization (JWT).

#### Week 2
- User roles (administrator, editor, reader).
- Creation of two types of documents: page, note.
- Viewing documents in a simple interface.

#### Week 3
- Organization of documents in folder structure.
- Adding tags to documents.
- Display of documents in lists with filtering by tags capability.

#### Week 4
- Implementation of document search by title, author, and tags.
- Basic navigation panel for folders and tags.
- Optimization of document display (pagination/limits).

#### Week 5
- Minimalist interface design.
- Testing of access rights functionality.

#### Week 6
- Integration with Google Drive/Dropbox (API for file storage).
- Uploading and attaching files to documents.
- Drag&Drop for file uploads.

#### Week 7
- Interface themes (light/dark).
- Code refactoring (Frontend + Backend).
- Unit tests for core modules.

#### Week 8
- Integration testing.
- Optimization of search speed and display.
- Project deployment in Docker environment.
- MVP demonstration preparation.

---

### 7. MVP Completion Criteria
- User can register and log in.
- User can create and edit pages and notes.
- Documents can be grouped by tags and in folders.
- Document search works.
- Dropbox integration for file storage is available.
