import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Documents from '../views/Documents.vue'

const routes = [
  { path: '/', redirect: '/documents' },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/documents', component: Documents }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router


