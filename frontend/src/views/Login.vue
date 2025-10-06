<template>
  <div class="row justify-content-center">
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-3">Login</h5>
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
            <button class="btn btn-primary w-100" type="submit" :disabled="submitting">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { object, string } from 'yup'

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errors = ref({})

const schema = object({
  email: string().required('Email is required').email('Enter a valid email'),
  password: string().required('Password is required').min(6, 'Min 6 characters')
})

async function onSubmit () {
  errors.value = {}
  try {
    submitting.value = true
    await schema.validate({ email: email.value, password: password.value }, { abortEarly: false })
    // TODO: call API
    alert('Login successful (mock)')
  } catch (e) {
    if (e.inner) {
      const map = {}
      e.inner.forEach(err => { map[err.path] = err.message })
      errors.value = map
    }
  } finally {
    submitting.value = false
  }
}
</script>


