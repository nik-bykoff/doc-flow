<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h5 class="mb-0">Documents</h5>
      <button class="btn btn-primary">New Document</button>
    </div>
    <div class="row g-3">
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-body">
            <h6 class="card-title">Markdown Preview</h6>
            <div v-html="html" class="markdown-body"></div>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-4">
        <div class="card">
          <div class="card-body">
            <h6 class="card-title">Source (mock)</h6>
            <textarea class="form-control" rows="10" v-model="md"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { marked } from 'marked'

const md = ref(`# Welcome to DocFlow\n\nThis is a **markdown** example with a pastel theme.`)
const html = computed(() => marked.parse(md.value))
</script>

<style>
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: var(--text-primary); }
.markdown-body a { color: var(--pastel-900); }
</style>