import { defineStore } from 'pinia'

function createInitialTree() {
  return [
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
}

function findNodeById(nodes, id) {
  const stack = [...nodes]
  while (stack.length) {
    const node = stack.pop()
    if (node.id === id) return node
    if (node.children) stack.push(...node.children)
  }
  return null
}

export const useDocumentsStore = defineStore('documents', {
  state: () => ({
    tree: createInitialTree(),
    expanded: JSON.parse(localStorage.getItem('expanded') || '[]'),
    selectedId: null,
    contents: { welcome: '# Welcome to DocFlow\n\nThis is a **markdown** example.' }
  }),

  getters: {
    selectedNode(state) {
      if (!state.selectedId) return null
      return findNodeById(state.tree, state.selectedId)
    },
    contentById: (state) => (id) => state.contents[id] || ''
  },

  actions: {
    setExpanded(ids) {
      this.expanded = ids
      localStorage.setItem('expanded', JSON.stringify(ids))
    },
    toggleExpanded(id) {
      const idx = this.expanded.indexOf(id)
      if (idx >= 0) this.expanded.splice(idx, 1)
      else this.expanded.push(id)
      localStorage.setItem('expanded', JSON.stringify(this.expanded))
    },
    addDocument(parentId) {
      const parent = findNodeById(this.tree, parentId)
      if (!parent) return null
      const newId = `doc-${Date.now()}`
      const newDoc = { id: newId, title: 'New Document', children: [] }
      parent.children = parent.children || []
      parent.children.unshift(newDoc)
      if (!this.expanded.includes(parentId)) this.expanded.push(parentId)
      localStorage.setItem('expanded', JSON.stringify(this.expanded))
      // ensure reactivity for nested mutation
      this.tree = this.tree.slice()
      this.contents[newId] = ''
      return newDoc
    },
    selectDocument(id) {
      this.selectedId = id
    },
    updateTitle(id, title) {
      const node = findNodeById(this.tree, id)
      if (node) {
        node.title = title
        this.tree = this.tree.slice()
      }
    },
    updateContent(id, content) {
      this.contents[id] = content
    }
  }
})


