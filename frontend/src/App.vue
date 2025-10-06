<template>
  <div class="app-container d-flex flex-column min-vh-100">
    <nav class="navbar navbar-expand-lg navbar-light bg-pastel border-bottom">
      <div class="container-fluid">
        <button class="btn btn-outline-secondary me-2 d-lg-none" @click="toggleSidebar" aria-label="Toggle sidebar">
          ☰
        </button>
        <a class="navbar-brand text-primary" href="#">DocFlow</a>
        <div class="ms-auto d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary" @click="toggleTheme">{{ themeLabel }}</button>
          <router-link class="btn btn-sm btn-link" to="/login">Login</router-link>
          <router-link class="btn btn-sm btn-link" to="/register">Register</router-link>
        </div>
      </div>
    </nav>

    <div class="container-fluid flex-grow-1">
      <div class="row h-100">
        <transition name="slide">
          <aside v-show="sidebarOpen" class="col-12 col-lg-3 col-xl-2 border-end px-0 sidebar">
            <Sidebar />
          </aside>
        </transition>
        <main class="col py-3">
          <transition name="fade" mode="out-in">
            <router-view />
          </transition>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'

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

const themeLabel = computed(() => theme.value === 'light' ? 'Dark mode' : 'Light mode')

onMounted(() => {
  const saved = localStorage.getItem('sidebarOpen')
  if (saved !== null) sidebarOpen.value = saved === 'true'
  applyTheme()
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


