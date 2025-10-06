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
  - Date.
- **Advanced filtering options:**
  - Filter by tags, authors, creation/modification date.
  - Support for combined search queries (e.g., by tag and author).
  - Real-time search suggestions as the user types.
- **Search performance:**  
  - Must return results in **under 1 second**, even when the database contains **10,000+ documents**.

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
- Sidebar with structured navigation tree (similar to Confluence).
- Search bar with filters and dynamic results.

---

### 4. Non-Functional Requirements
- The system must be accessible via web browser.
- Performance: search and document loading no more than **1 second**, even with **10,000+ documents**.
- Security: password storage in hashed form (bcrypt/argon2).
- Scalability: containerization support (Docker).
- API for integrations: REST and basic GraphQL.

#### 4.1 Supported Browsers
| Browser | Minimum Version | Notes |
|----------|------------------|--------|
| Google Chrome | 110+ | Recommended for best performance |
| Mozilla Firefox | 110+ | Full support for SPA and Markdown editing |
| Microsoft Edge | 110+ | Fully supported |
| Safari | 15+ | Tested for macOS and iOS compatibility |
| Opera | 95+ | Supported for general use |

#### 4.2 Performance
- **Search and document loading:** ≤ 1 second for up to **10,000 documents**.
- **Average request processing time (API):** ≤ 300 ms for standard CRUD operations.
- **Page load time (SPA):** ≤ 2 seconds on initial load.
- **Concurrent users:** System must support at least **100 active sessions** simultaneously without degradation of performance.
- **Download speed for files:** Target average of **≥ 2 MB/s**, depending on network conditions.
- **File upload and preview processing:** Must complete within **5 seconds** for files ≤ 5 MB.

---

### 5. Architecture
- **Frontend**: VueJS (SPA, Markdown editor support).
- **Backend**: NodeJS (NestJS or Express).
- **Database**: PostgreSQL (storage of documents and users).
- **File storage**: Dropbox integration.
- **Hosting**: Docker, preparation for Kubernetes.
- **Authentication**: JWT tokens.

---

### 6. Implementation Stages (MVP, 8 weeks, starts from 29.09.2025)

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
- Implementation of document search by title, author, tags, and date.
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
- User can create and edit documents and notes.
- Documents can be grouped by tags and in folders.
- Document search works with filters by title, tag, author, and date.
- Dropbox integration for file storage is available.
- Search results load in under 1 second, even with 10,000+ documents.