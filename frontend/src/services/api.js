/**
 * API Service
 * Centralized API client for all backend communication
 */

import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request(endpoint, options = {}) {
  const authStore = useAuthStore()

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }

  // Add auth token if available
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }

  // Add body if provided
  if (options.body) {
    config.body = JSON.stringify(options.body)
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)

    let data = null
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error || `HTTP ${response.status}`,
        response.status,
        data
      )
    }

    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(error.message, 0, null)
  }
}

// Documents API
export const documentsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/documents?${query}`)
  },
  get: (id) => request(`/documents/${id}`),
  create: (data) => request('/documents', { method: 'POST', body: data }),
  update: (id, data) => request(`/documents/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  addTag: (id, tagName) => request(`/documents/${id}/tags`, {
    method: 'POST',
    body: { tag_name: tagName }
  }),
  removeTag: (id, tagId) => request(`/documents/${id}/tags/${tagId}`, { method: 'DELETE' }),
  getActivity: (id) => request(`/documents/${id}/activity`)
}

// Folders API
export const foldersApi = {
  list: (courseId) => request(`/folders${courseId ? `?course_id=${courseId}` : ''}`),
  get: (id) => request(`/folders/${id}`),
  create: (data) => request('/folders', { method: 'POST', body: data }),
  update: (id, data) => request(`/folders/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/folders/${id}`, { method: 'DELETE' })
}

// Courses API
export const coursesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/courses?${query}`)
  },
  get: (id) => request(`/courses/${id}`),
  create: (data) => request('/courses', { method: 'POST', body: data }),
  update: (id, data) => request(`/courses/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  enroll: (id, userEmail, role) => request(`/courses/${id}/enroll`, {
    method: 'POST',
    body: { user_email: userEmail, role }
  }),
  removeEnrollment: (courseId, enrollmentId) =>
    request(`/courses/${courseId}/enrollments/${enrollmentId}`, { method: 'DELETE' }),
  getProjects: (id) => request(`/courses/${id}/projects`),
  createProject: (id, data) => request(`/courses/${id}/projects`, {
    method: 'POST',
    body: data
  }),
  getActivity: (id) => request(`/courses/${id}/activity`)
}

// Tasks API
export const tasksApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/tasks?${query}`)
  },
  get: (id) => request(`/tasks/${id}`),
  create: (data) => request('/tasks', { method: 'POST', body: data }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  assign: (id, userIds, assignAll = false) => request(`/tasks/${id}/assign`, {
    method: 'POST',
    body: { user_ids: userIds, assign_all: assignAll }
  }),
  getSubmissions: (id) => request(`/tasks/${id}/submissions`)
}

// Submissions API
export const submissionsApi = {
  getMy: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/submissions/my?${query}`)
  },
  get: (id) => request(`/submissions/${id}`),
  create: (data) => request('/submissions', { method: 'POST', body: data }),
  update: (id, data) => request(`/submissions/${id}`, { method: 'PUT', body: data }),
  grade: (id, score, feedback) => request(`/submissions/${id}/grade`, {
    method: 'POST',
    body: { score, feedback }
  }),
  delete: (id) => request(`/submissions/${id}`, { method: 'DELETE' })
}

// Search API
export const searchApi = {
  search: (query, type, courseId, limit = 50) => {
    const params = new URLSearchParams({ q: query, limit })
    if (type) params.append('type', type)
    if (courseId) params.append('course_id', courseId)
    return request(`/search?${params}`)
  }
}

// Comments API
export const commentsApi = {
  list: (entityType, entityId) => request(`/comments?entity_type=${entityType}&entity_id=${entityId}`),
  create: (data) => request('/comments', { method: 'POST', body: data }),
  update: (id, content) => request(`/comments/${id}`, {
    method: 'PUT',
    body: { content }
  }),
  delete: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
  resolve: (id) => request(`/comments/${id}/resolve`, { method: 'POST' })
}

// Files API
export const filesApi = {
  upload: async (file, entityType, entityId) => {
    const authStore = useAuthStore()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity_type', entityType)
    formData.append('entity_id', entityId)

    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(data.error || 'Upload failed', response.status, data)
    }

    return data
  },
  get: (id) => request(`/files/${id}`),
  download: (id) => `${API_BASE_URL}/files/${id}/download`,
  delete: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  list: (entityType, entityId) => request(`/files?entity_type=${entityType}&entity_id=${entityId}`)
}

export { ApiError }
