<template>
  <div class="p-3">
    <input v-model="query" type="text" class="form-control mb-3" placeholder="Search pages..." />
    <div class="list-group">
      <TreeItem
        v-for="item in filteredTree"
        :key="item.id"
        :node="item"
        :expandedIds="expanded"
        @toggle="onToggle"
        @select="onSelect"
        @add="onAdd"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentsStore } from '../stores/documents'
import TreeItem from './TreeItem.vue'

const router = useRouter()
const docs = useDocumentsStore()

const expanded = ref(docs.expanded)
const query = ref('')

const filteredTree = computed(() => filterTree(docs.tree, query.value))

watch(expanded, (val) => { docs.setExpanded(val) }, { deep: true })

function onToggle(id) {
  docs.toggleExpanded(id)
}

function onSelect(node) {
  docs.selectDocument(node.id)
  router.push(`/documents/${node.id}`)
}

function onAdd(parentId) {
  const newDoc = docs.addDocument(parentId)
  if (newDoc) {
    docs.selectDocument(newDoc.id)
    router.push(`/documents/${newDoc.id}`)
  }
}

function isMatch(node, q) {
  return node.title.toLowerCase().includes(q)
}

function filterTree(nodes, q) {
  const queryLower = q.trim().toLowerCase()
  if (!queryLower) return nodes
  return nodes
    .map(n => {
      const children = filterTree(n.children || [], queryLower)
      if (isMatch(n, queryLower) || children.length) {
        return { ...n, children }
      }
      return null
    })
    .filter(Boolean)
}
</script>


