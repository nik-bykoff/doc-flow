<template>
  <div class="row justify-content-center">
    <div class="col-12 col-md-6 col-lg-5">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-3">Register</h5>
          <div v-if="authStore.error" class="alert alert-danger">{{ authStore.error }}</div>
          <form @submit.prevent="onSubmit" novalidate>
            <div class="mb-3">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" v-model="email" :class="{'is-invalid': errors.email}" />
              <div class="invalid-feedback" v-if="errors.email">{{ errors.email }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Password</label>
              <input type="password" class="form-control" v-model="password" :class="{'is-invalid': errors.password}" />
              <div class="invalid-feedback" v-if="errors.password">{{ errors.password }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Confirm Password</label>
              <input type="password" class="form-control" v-model="confirm" :class="{'is-invalid': errors.confirm}" />
              <div class="invalid-feedback" v-if="errors.confirm">{{ errors.confirm }}</div>
            </div>
            <button class="btn btn-primary w-100" type="submit" :disabled="authStore.isLoading">
              <span v-if="authStore.isLoading" class="spinner-border spinner-border-sm me-2"></span>
              Create account
            </button>
          </form>
          <div class="text-center mt-3">
            <router-link to="/login">Already have an account? Login</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { object, string, ref as yupRef } from 'yup'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const confirm = ref('')
const errors = ref({})

const schema = object({
  email: string().required('Email is required').email('Enter a valid email'),
  password: string().required('Password is required').min(6, 'Min 6 characters'),
  confirm: string().oneOf([yupRef('password')], 'Passwords must match').required('Confirm your password')
})

async function onSubmit () {
  errors.value = {}
  authStore.clearError()
  
  try {
    await schema.validate({ email: email.value, password: password.value, confirm: confirm.value }, { abortEarly: false })
    const result = await authStore.register(email.value, password.value)
    
    if (result.success) {
      router.push('/documents')
    }
  } catch (e) {
    if (e.inner) {
      const map = {}
      e.inner.forEach(err => { map[err.path] = err.message })
      errors.value = map
    }
  }
}

onMounted(() => {
  authStore.clearError()
})
</script>


