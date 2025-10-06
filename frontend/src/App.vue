<template>
  <div class="app-container">
    <nav class="navbar navbar-expand-lg navbar-light bg-pastel">
      <div class="container-fluid">
        <a class="navbar-brand text-primary" href="#">DocFlow</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <router-link class="nav-link" to="/login">Login</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/register">Register</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/documents">Documents</router-link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <main class="container py-4">
      <router-view />
    </main>
  </div>
  
</template>

<script setup>
</script>

<style>
.bg-pastel { background-color: var(--pastel-100); }
</style>


