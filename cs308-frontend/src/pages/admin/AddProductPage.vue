<template>
  <div class="p-6 max-w-7xl">
    <h1 class="text-3xl font-bold mb-6">Add Product</h1>

    <p v-if="error" class="mb-4 text-red-600">{{ error }}</p>
    <p v-if="categoriesLoading" class="mb-4 text-gray-600">Loading categories...</p>

    <ProductForm
      v-if="!categoriesLoading"
      :categories="categories"
      submit-label="Create Product"
      @submit="handleCreate"
      @cancel="goBack"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCategories } from '../../api/categoryApi'
import { createProduct } from '../../api/productApi'
import ProductForm from '../../components/admin/ProductForm.vue'

const router = useRouter()
const error = ref('')
const categories = ref([])
const categoriesLoading = ref(true)

const loadCategories = async () => {
  categoriesLoading.value = true

  try {
    const res = await getCategories()
    categories.value = res.data.categories || []
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load categories'
  } finally {
    categoriesLoading.value = false
  }
}

const handleCreate = async (formData) => {
  try {
    await createProduct(formData)
    router.push('/admin/products')
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to create product'
    console.error(err)
  }
}

const goBack = () => {
  router.push('/admin/products')
}

onMounted(loadCategories)
</script>
