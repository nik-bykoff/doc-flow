import { defineStore } from 'pinia'
import { documentsApi, foldersApi } from '../services/api'

export const useDocumentsStore = defineStore('documents', {
  state: () => ({
    documents: [],
    folders: [],
    currentDocument: null,
    loading: false,
    error: null,
    expanded: JSON.parse(localStorage.getItem('expanded') || '[]')
  }),

  getters: {
    documentTree(state) {
      // Build tree from folders and documents
      const buildTree = (parentId = null) => {
        const folderNodes = state.folders
          .filter(f => f.parent_id === parentId)
          .map(folder => ({
            id: folder.id,
            title: folder.name,
            type: 'folder',
            children: buildTree(folder.id)
          }))

        // Add documents without folders at root level
        if (parentId === null) {
          const rootDocs = state.documents
            .filter(d => !d.folder_id)
            .map(doc => ({
              id: doc.id,
              title: doc.title,
              type: 'document',
              children: []
            }))
          return [...folderNodes, ...rootDocs]
        }

        return folderNodes
      }

      return buildTree()
    }
  },

  actions: {
    async fetchDocuments(filters = {}) {
      this.loading = true
      this.error = null
      try {
        const response = await documentsApi.list(filters)
        this.documents = response.documents
      } catch (error) {
        this.error = error.message
        console.error('Error fetching documents:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchFolders(courseId = null) {
      try {
        const response = await foldersApi.list(courseId)
        this.folders = response.folders
      } catch (error) {
        console.error('Error fetching folders:', error)
      }
    },

    async getDocument(id) {
      this.loading = true
      this.error = null
      try {
        this.currentDocument = await documentsApi.get(id)
      } catch (error) {
        this.error = error.message
        console.error('Error fetching document:', error)
      } finally {
        this.loading = false
      }
    },

    async createDocument(data) {
      this.loading = true
      this.error = null
      try {
        const newDoc = await documentsApi.create(data)
        this.documents.unshift(newDoc)
        return newDoc
      } catch (error) {
        this.error = error.message
        console.error('Error creating document:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateDocument(id, data) {
      this.loading = true
      this.error = null
      try {
        const updated = await documentsApi.update(id, data)

        // Update in list
        const index = this.documents.findIndex(d => d.id === id)
        if (index !== -1) {
          this.documents[index] = { ...this.documents[index], ...updated }
        }

        // Update current if it's the one being edited
        if (this.currentDocument && this.currentDocument.id === id) {
          this.currentDocument = { ...this.currentDocument, ...updated }
        }

        return updated
      } catch (error) {
        this.error = error.message
        console.error('Error updating document:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteDocument(id) {
      this.loading = true
      this.error = null
      try {
        await documentsApi.delete(id)
        this.documents = this.documents.filter(d => d.id !== id)
        if (this.currentDocument && this.currentDocument.id === id) {
          this.currentDocument = null
        }
      } catch (error) {
        this.error = error.message
        console.error('Error deleting document:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async createFolder(name, parentId = null) {
      try {
        const newFolder = await foldersApi.create({ name, parent_id: parentId })
        this.folders.push(newFolder)
        if (parentId && !this.expanded.includes(parentId)) {
          this.expanded.push(parentId)
          localStorage.setItem('expanded', JSON.stringify(this.expanded))
        }
        return newFolder
      } catch (error) {
        console.error('Error creating folder:', error)
        throw error
      }
    },

    setExpanded(ids) {
      this.expanded = ids
      localStorage.setItem('expanded', JSON.stringify(ids))
    },

    toggleExpanded(id) {
      const idx = this.expanded.indexOf(id)
      if (idx >= 0) {
        this.expanded.splice(idx, 1)
      } else {
        this.expanded.push(id)
      }
      localStorage.setItem('expanded', JSON.stringify(this.expanded))
    }
  }
})
