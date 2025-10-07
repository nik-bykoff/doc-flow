<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div class="d-flex align-items-center gap-3">
        <h5 class="mb-0">{{ title || 'Untitled Document' }}</h5>
        <button class="btn btn-sm btn-outline-secondary" @click="toggleEditor">
          <span v-if="showEditor">Hide editor</span>
          <span v-else>Show editor</span>
        </button>
      </div>
      <button class="btn btn-primary" @click="openNewModal">New Document</button>
    </div>
    <div class="row g-3">
      <div class="col-12" :class="showEditor ? 'col-lg-8' : 'col-lg-12'">
        <div class="card">
          <div class="card-body">
            <h6 class="card-title">Preview</h6>
            <div v-html="html" class="markdown-body"></div>
          </div>
        </div>
      </div>
      <div v-if="showEditor" class="col-12 col-lg-4">
        <div class="card">
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label">Title</label>
              <input type="text" class="form-control" v-model="title" placeholder="Document title" />
            </div>
            <label class="form-label">Markdown</label>
            <textarea class="form-control" rows="14" v-model="md"></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- New Document Modal -->
    <div class="modal fade" tabindex="-1" :class="{ show: showNewModal }" style="display: block;" v-if="showNewModal" aria-modal="true" role="dialog">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create New Document</h5>
            <button type="button" class="btn-close" @click="closeNewModal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Title</label>
              <input type="text" class="form-control" v-model="newTitle" placeholder="Enter title" />
            </div>
            <div class="form-text">Content starts empty. You can edit after creating.</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeNewModal">Cancel</button>
            <button type="button" class="btn btn-primary" @click="createNew">Create</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showNewModal" class="modal-backdrop fade show" @click="closeNewModal"></div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentsStore } from '../stores/documents'
import { marked } from 'marked'

const route = useRoute()
const docs = useDocumentsStore()

const title = ref('Welcome to DocFlow')
const md = ref(docs.contentById('welcome'))
const html = computed(() => marked.parse(md.value))

const showEditor = ref(false)
const showNewModal = ref(false)
const newTitle = ref('')

function toggleEditor () {
  showEditor.value = !showEditor.value
}

function openNewModal () {
  newTitle.value = ''
  showNewModal.value = true
}

function closeNewModal () {
  showNewModal.value = false
}

function createNew () {
  const t = newTitle.value.trim()
  if (!t) return
  const currentId = route.params.id || 'welcome'
  docs.updateTitle(currentId, t)
  title.value = t
  md.value = ''
  docs.updateContent(currentId, md.value)
  showEditor.value = true
  closeNewModal()
}

// Load selected document by route param
watchEffect(() => {
  const id = route.params.id || 'welcome'
  const node = docs.selectedNode || { id, title: id }
  if (docs.selectedId !== id) docs.selectDocument(id)
  title.value = node.title || 'Untitled Document'
  md.value = docs.contentById(id)
})

// Sync edits to store
watchEffect(() => {
  const id = route.params.id || 'welcome'
  docs.updateTitle(id, title.value)
  docs.updateContent(id, md.value)
})
</script>

<style>
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: var(--text-primary); }
.markdown-body a { color: var(--pastel-900); }
</style>