<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h5 class="mb-0">Documents</h5>
      <button class="btn btn-primary">New Document</button>
    </div>
    <div class="row g-3">
      <div class="col-12 col-md-6 col-lg-4" v-for="i in 6" :key="i">
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-title">Sample Document {{ i }}</h6>
            <p class="card-text text-secondary">Short description in pastel theme.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>