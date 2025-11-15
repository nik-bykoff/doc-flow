import { defineStore } from 'pinia'
import { coursesApi } from '../services/api'

export const useCoursesStore = defineStore('courses', {
  state: () => ({
    courses: [],
    currentCourse: null,
    loading: false,
    error: null
  }),

  getters: {
    activeCourses(state) {
      return state.courses.filter(c => c.is_active)
    },

    inactiveCourses(state) {
      return state.courses.filter(c => !c.is_active)
    },

    getCourseById: (state) => (id) => {
      return state.courses.find(c => c.id === id)
    }
  },

  actions: {
    async fetchCourses(filters = {}) {
      this.loading = true
      this.error = null
      try {
        const response = await coursesApi.list(filters)
        this.courses = response.courses
      } catch (error) {
        this.error = error.message
        console.error('Error fetching courses:', error)
      } finally {
        this.loading = false
      }
    },

    async getCourse(id) {
      this.loading = true
      this.error = null
      try {
        this.currentCourse = await coursesApi.get(id)
      } catch (error) {
        this.error = error.message
        console.error('Error fetching course:', error)
      } finally {
        this.loading = false
      }
    },

    async createCourse(data) {
      this.loading = true
      this.error = null
      try {
        const newCourse = await coursesApi.create(data)
        this.courses.unshift(newCourse)
        return newCourse
      } catch (error) {
        this.error = error.message
        console.error('Error creating course:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateCourse(id, data) {
      this.loading = true
      this.error = null
      try {
        const updated = await coursesApi.update(id, data)
        const index = this.courses.findIndex(c => c.id === id)
        if (index !== -1) {
          this.courses[index] = { ...this.courses[index], ...updated }
        }
        if (this.currentCourse && this.currentCourse.id === id) {
          this.currentCourse = { ...this.currentCourse, ...updated }
        }
        return updated
      } catch (error) {
        this.error = error.message
        console.error('Error updating course:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteCourse(id) {
      this.loading = true
      this.error = null
      try {
        await coursesApi.delete(id)
        this.courses = this.courses.filter(c => c.id !== id)
        if (this.currentCourse && this.currentCourse.id === id) {
          this.currentCourse = null
        }
      } catch (error) {
        this.error = error.message
        console.error('Error deleting course:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async enrollUser(courseId, userEmail, role = 'student') {
      try {
        await coursesApi.enroll(courseId, userEmail, role)
        // Refresh course details to show new enrollment
        if (this.currentCourse && this.currentCourse.id === courseId) {
          await this.getCourse(courseId)
        }
      } catch (error) {
        console.error('Error enrolling user:', error)
        throw error
      }
    },

    async createProject(courseId, data) {
      try {
        const newProject = await coursesApi.createProject(courseId, data)
        // Add to current course if loaded
        if (this.currentCourse && this.currentCourse.id === courseId) {
          this.currentCourse.projects = this.currentCourse.projects || []
          this.currentCourse.projects.push(newProject)
        }
        return newProject
      } catch (error) {
        console.error('Error creating project:', error)
        throw error
      }
    }
  }
})
