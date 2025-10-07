<template>
  <div class="app-container d-flex flex-column min-vh-100">
    <nav class="navbar navbar-expand-lg navbar-light bg-pastel border-bottom">
      <div class="container-fluid">
        <button v-if="authStore.isAuthenticated" class="btn btn-outline-secondary me-2 d-lg-none" @click="toggleSidebar" aria-label="Toggle sidebar">
          ☰
        </button>
        <a class="navbar-brand text-primary" href="#">DocFlow</a>
        <div class="ms-auto d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary" @click="toggleTheme" :title="themeLabel" aria-label="Toggle theme">
            <span v-if="theme==='light'">🌙</span>
            <span v-else>☀️</span>
          </button>
          <template v-if="authStore.isAuthenticated">
            <span class="text-secondary">{{ authStore.user.email }}</span>
            <button class="btn btn-sm btn-outline-danger" @click="logout">Logout</button>
          </template>
          <template v-else>
            <router-link class="btn btn-sm btn-link" to="/login">Login</router-link>
            <router-link class="btn btn-sm btn-link" to="/register">Register</router-link>
          </template>
        </div>
      </div>
    </nav>

    <div class="container-fluid flex-grow-1">
      <div class="row h-100">
        <transition name="slide">
          <aside v-show="sidebarOpen && authStore.isAuthenticated" class="col-12 col-lg-3 col-xl-2 border-end px-0 sidebar">
            <Sidebar />
          </aside>
        </transition>
        <main :class="authStore.isAuthenticated ? 'col py-3' : 'col-12 py-3'">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import Sidebar from './components/Sidebar.vue'

const router = useRouter()
const authStore = useAuthStore()

const sidebarOpen = ref(true)
const theme = ref(localStorage.getItem('theme') || 'light')

function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value)
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  localStorage.setItem('sidebarOpen', String(sidebarOpen.value))
}

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
  applyTheme()
}

async function logout() {
  await authStore.logout()
  router.push('/login')
}

const themeLabel = computed(() => theme.value === 'light' ? 'Switch to dark' : 'Switch to light')

onMounted(async () => {
  const saved = localStorage.getItem('sidebarOpen')
  if (saved !== null) sidebarOpen.value = saved === 'true'
  applyTheme()
  
  // Check auth status on app load
  await authStore.checkAuth()
})
</script>

<style>
.bg-pastel { background-color: var(--pastel-100); }
.sidebar { background: var(--pastel-50); }

.slide-enter-active, .slide-leave-active { transition: all .2s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(-10px); opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>


