import { defineStore } from 'pinia'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
// Ensure axios uses the correct API root
axios.defaults.baseURL = API_BASE

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token'),
    isLoading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    userRole: (state) => state.user?.role || 'reader'
  },

  actions: {
    async login(email, password) {
      this.isLoading = true
      this.error = null
      
      try {
        const response = await axios.post('/auth/login', {
          email,
          password
        })
        
        const { user, token } = response.data
        this.user = user
        this.token = token
        localStorage.setItem('token', token)
        
        // Set default axios header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        
        return { success: true }
      } catch (error) {
        this.error = error.response?.data?.error || 'Login failed'
        return { success: false, error: this.error }
      } finally {
        this.isLoading = false
      }
    },

    async register(email, password) {
      this.isLoading = true
      this.error = null
      
      try {
        const response = await axios.post('/auth/register', {
          email,
          password
        })
        
        const { user, token } = response.data
        this.user = user
        this.token = token
        localStorage.setItem('token', token)
        
        // Set default axios header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        
        return { success: true }
      } catch (error) {
        this.error = error.response?.data?.error || 'Registration failed'
        return { success: false, error: this.error }
      } finally {
        this.isLoading = false
      }
    },

    async checkAuth() {
      const token = localStorage.getItem('token')
      if (!token) return false
      
      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        const response = await axios.get('/auth/me')
        this.user = response.data.user
        this.token = token
        return true
      } catch (error) {
        this.logout()
        return false
      }
    },

    logout() {
      this.user = null
      this.token = null
      this.error = null
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
    },

    clearError() {
      this.error = null
    }
  }
})
