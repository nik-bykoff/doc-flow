<template>
  <div class="p-3">
    <input v-model="query" type="text" class="form-control mb-3" placeholder="Search pages..." />
    <div class="list-group">
      <TreeItem
        v-for="item in filteredTree"
        :key="item.id"
        :node="item"
        @toggle="onToggle"
        @select="onSelect"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TreeItem from './TreeItem.vue'

const defaultTree = [
  { id: 'pages', title: 'Pages', children: [
    { id: 'welcome', title: 'Welcome', children: [] },
    { id: 'getting-started', title: 'Getting Started', children: [
      { id: 'install', title: 'Install', children: [] },
      { id: 'configure', title: 'Configure', children: [] }
    ]}
  ]},
  { id: 'notes', title: 'Notes', children: [
    { id: 'ideas', title: 'Ideas', children: [] }
  ]}
]

const expanded = ref(JSON.parse(localStorage.getItem('expanded') || '[]'))
const query = ref('')

const filteredTree = computed(() => filterTree(defaultTree, query.value))

watch(expanded, (val) => {
  localStorage.setItem('expanded', JSON.stringify(val))
}, { deep: true })

function onToggle(id) {
  const idx = expanded.value.indexOf(id)
  if (idx >= 0) expanded.value.splice(idx, 1)
  else expanded.value.push(id)
}

function onSelect(node) {
  // In a real app, navigate to the document route
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


