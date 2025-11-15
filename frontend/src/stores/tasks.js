import { defineStore } from 'pinia'
import { tasksApi, submissionsApi } from '../services/api'

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    mySubmissions: [],
    currentTask: null,
    loading: false,
    error: null
  }),

  getters: {
    tasksByCourse: (state) => (courseId) => {
      return state.tasks.filter(t => t.course_id === courseId)
    },

    upcomingTasks(state) {
      const now = new Date()
      return state.tasks
        .filter(t => t.due_date && new Date(t.due_date) > now)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    },

    overdueTasks(state) {
      const now = new Date()
      return state.tasks
        .filter(t => t.due_date && new Date(t.due_date) < now && t.assignment_status !== 'graded')
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    }
  },

  actions: {
    async fetchTasks(filters = {}) {
      this.loading = true
      this.error = null
      try {
        const response = await tasksApi.list(filters)
        this.tasks = response.tasks
      } catch (error) {
        this.error = error.message
        console.error('Error fetching tasks:', error)
      } finally {
        this.loading = false
      }
    },

    async getTask(id) {
      this.loading = true
      this.error = null
      try {
        this.currentTask = await tasksApi.get(id)
      } catch (error) {
        this.error = error.message
        console.error('Error fetching task:', error)
      } finally {
        this.loading = false
      }
    },

    async createTask(data) {
      this.loading = true
      this.error = null
      try {
        const newTask = await tasksApi.create(data)
        this.tasks.unshift(newTask)
        return newTask
      } catch (error) {
        this.error = error.message
        console.error('Error creating task:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateTask(id, data) {
      this.loading = true
      this.error = null
      try {
        const updated = await tasksApi.update(id, data)
        const index = this.tasks.findIndex(t => t.id === id)
        if (index !== -1) {
          this.tasks[index] = { ...this.tasks[index], ...updated }
        }
        if (this.currentTask && this.currentTask.id === id) {
          this.currentTask = { ...this.currentTask, ...updated }
        }
        return updated
      } catch (error) {
        this.error = error.message
        console.error('Error updating task:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteTask(id) {
      this.loading = true
      this.error = null
      try {
        await tasksApi.delete(id)
        this.tasks = this.tasks.filter(t => t.id !== id)
        if (this.currentTask && this.currentTask.id === id) {
          this.currentTask = null
        }
      } catch (error) {
        this.error = error.message
        console.error('Error deleting task:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async assignTask(id, userIds, assignAll = false) {
      try {
        await tasksApi.assign(id, userIds, assignAll)
        // Refresh task to show assignments
        if (this.currentTask && this.currentTask.id === id) {
          await this.getTask(id)
        }
      } catch (error) {
        console.error('Error assigning task:', error)
        throw error
      }
    },

    async fetchMySubmissions(filters = {}) {
      this.loading = true
      this.error = null
      try {
        const response = await submissionsApi.getMy(filters)
        this.mySubmissions = response.submissions
      } catch (error) {
        this.error = error.message
        console.error('Error fetching submissions:', error)
      } finally {
        this.loading = false
      }
    },

    async submitWork(taskId, content) {
      this.loading = true
      this.error = null
      try {
        const submission = await submissionsApi.create({ task_id: taskId, content })
        // Add to mySubmissions
        this.mySubmissions.unshift(submission)
        // Update task assignment status
        const taskIndex = this.tasks.findIndex(t => t.id === taskId)
        if (taskIndex !== -1) {
          this.tasks[taskIndex].assignment_status = 'submitted'
        }
        return submission
      } catch (error) {
        this.error = error.message
        console.error('Error submitting work:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async gradeSubmission(submissionId, score, feedback) {
      this.loading = true
      this.error = null
      try {
        const graded = await submissionsApi.grade(submissionId, score, feedback)
        // Update in mySubmissions if present
        const index = this.mySubmissions.findIndex(s => s.id === submissionId)
        if (index !== -1) {
          this.mySubmissions[index] = { ...this.mySubmissions[index], ...graded }
        }
        return graded
      } catch (error) {
        this.error = error.message
        console.error('Error grading submission:', error)
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})
