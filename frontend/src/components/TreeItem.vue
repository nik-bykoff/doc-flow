<template>
  <div class="list-group-item border-0 ps-0">
    <div class="d-flex align-items-center">
      <button class="btn btn-sm btn-outline-secondary me-2" v-if="hasChildren" @click="$emit('toggle', node.id)">
        {{ isExpanded ? '▾' : '▸' }}
      </button>
      <button class="btn btn-sm btn-link text-decoration-none" @click="$emit('select', node)">{{ node.title }}</button>
    </div>
    <transition name="fade">
      <div v-if="isExpanded" class="ms-4 mt-2">
        <TreeItem v-for="child in node.children" :key="child.id" :node="child" @toggle="$emit('toggle', $event)" @select="$emit('select', $event)" />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ node: { type: Object, required: true }})
const isExpanded = computed(() => {
  const expanded = JSON.parse(localStorage.getItem('expanded') || '[]')
  return expanded.includes(props.node.id)
})
const hasChildren = computed(() => (props.node.children || []).length > 0)
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>


