<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="mb-2 text-sm font-semibold text-orange-600">Catalog</p>
        <h1 class="text-3xl font-bold text-gray-900">Categories</h1>
        <p class="mt-2 text-gray-600">
          Manage product categories used by listings and product forms.
        </p>
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
        @click="startCreate"
      >
        Add Category
      </button>
    </div>

    <div v-if="loading" class="rounded-3xl border border-gray-200 bg-white p-6 text-gray-600">
      Loading categories...
    </div>

    <div v-else-if="error" class="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-600">
      {{ error }}
    </div>

    <template v-else>
      <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-3xl border border-gray-200 bg-white p-5">
          <p class="mb-2 text-sm text-gray-500">Total Categories</p>
          <p class="text-3xl font-bold text-gray-900">{{ categories.length }}</p>
        </div>

        <div class="rounded-3xl border border-gray-200 bg-white p-5">
          <p class="mb-2 text-sm text-gray-500">With Description</p>
          <p class="text-3xl font-bold text-gray-900">{{ describedCategoryCount }}</p>
        </div>

        <div class="rounded-3xl border border-gray-200 bg-white p-5">
          <p class="mb-2 text-sm text-gray-500">Available In Forms</p>
          <p class="text-3xl font-bold text-gray-900">{{ categories.length }}</p>
        </div>
      </div>

      <p
        v-if="successMessage"
        class="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-700"
      >
        {{ successMessage }}
      </p>

      <div class="mb-6 rounded-3xl border border-gray-200 bg-white p-4">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search by category ID, name, or description..."
          class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
        />
      </div>

      <div
        v-if="filteredCategories.length === 0"
        class="rounded-3xl border border-gray-200 bg-white p-8 text-gray-600"
      >
        No categories found.
      </div>

      <div v-else class="overflow-hidden rounded-3xl border border-gray-200 bg-white">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[840px]">
            <thead class="bg-gray-50">
              <tr class="text-left text-sm text-gray-600">
                <th class="px-6 py-4 font-semibold">Name</th>
                <th class="px-6 py-4 font-semibold">Category ID</th>
                <th class="px-6 py-4 font-semibold">Description</th>
                <th class="px-6 py-4 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="category in filteredCategories"
                :key="category.categoryId"
                class="border-t border-gray-100 hover:bg-gray-50/70"
              >
                <td class="px-6 py-4">
                  <p class="font-semibold text-gray-900">{{ category.name }}</p>
                </td>
                <td class="px-6 py-4 font-mono text-sm text-gray-700">
                  {{ category.categoryId }}
                </td>
                <td class="px-6 py-4 text-gray-600">
                  {{ category.description || 'No description' }}
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                      @click="startEdit(category)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                      @click="openDeleteModal(category)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div
      v-if="showFormModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div class="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <p class="mb-2 text-sm font-semibold text-orange-600">
          {{ editingCategory ? 'Edit Category' : 'New Category' }}
        </p>
        <h2 class="mb-5 text-2xl font-bold text-gray-900">
          {{ editingCategory ? editingCategory.name : 'Add category' }}
        </h2>

        <form class="space-y-4" @submit.prevent="submitCategory">
          <div>
            <label class="mb-1 block font-medium text-gray-700">Category ID</label>
            <input
              :value="form.categoryId"
              :disabled="Boolean(editingCategory)"
              class="w-full rounded-2xl border border-gray-300 px-4 py-3 font-mono outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              placeholder="smartphones"
              @input="onCategoryIdInput"
            />
            <p class="mt-1 text-xs text-gray-500">Auto-generated from name as a slug. You can edit it manually. Cannot be changed after creation.</p>
          </div>

          <div>
            <label class="mb-1 block font-medium text-gray-700">Name</label>
            <input
              v-model="form.name"
              class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
              placeholder="Smartphones"
            />
          </div>

          <div>
            <label class="mb-1 block font-medium text-gray-700">Description</label>
            <textarea
              v-model="form.description"
              rows="4"
              class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
              placeholder="Optional category description"
            />
          </div>

          <p v-if="formError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">
            {{ formError }}
          </p>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-2xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400"
              :disabled="saving"
              @click="closeFormModal"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
              :disabled="saving"
            >
              {{ saving ? 'Saving...' : 'Save Category' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="categoryToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <p class="mb-2 text-sm font-semibold text-red-600">Danger Zone</p>
        <h2 class="mb-3 text-2xl font-bold text-gray-900">Delete category?</h2>
        <p class="mb-5 text-gray-600">
          You are about to delete
          <span class="font-semibold text-gray-900">{{ categoryToDelete.name }}</span>.
          Categories assigned to products cannot be deleted.
        </p>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-2xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400"
            @click="closeDeleteModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            @click="confirmDelete"
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../../api/categoryApi'

const categories = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const formError = ref('')
const successMessage = ref('')
const searchTerm = ref('')
const showFormModal = ref(false)
const editingCategory = ref(null)
const categoryToDelete = ref(null)

const form = reactive({
  categoryId: '',
  name: '',
  description: '',
})

const categoryIdManuallyEdited = ref(false)

const toSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// Auto-generate slug from name when creating a new category
watch(() => form.name, (name) => {
  if (!editingCategory.value && !categoryIdManuallyEdited.value) {
    form.categoryId = toSlug(name)
  }
})

// Enforce slug format on manual Category ID edits
const onCategoryIdInput = (e) => {
  categoryIdManuallyEdited.value = true
  form.categoryId = toSlug(e.target.value)
}

const loadCategories = async () => {
  loading.value = true
  error.value = ''

  try {
    const res = await getCategories()
    categories.value = res.data.categories || []
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load categories'
  } finally {
    loading.value = false
  }
}

const describedCategoryCount = computed(() =>
  categories.value.filter((category) => String(category.description || '').trim()).length
)

const filteredCategories = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  if (!term) return categories.value

  return categories.value.filter((category) => {
    return (
      String(category.categoryId || '').toLowerCase().includes(term) ||
      String(category.name || '').toLowerCase().includes(term) ||
      String(category.description || '').toLowerCase().includes(term)
    )
  })
})

const resetForm = () => {
  form.categoryId = ''
  form.name = ''
  form.description = ''
  formError.value = ''
}

const startCreate = () => {
  editingCategory.value = null
  categoryIdManuallyEdited.value = false
  resetForm()
  showFormModal.value = true
}

const startEdit = (category) => {
  editingCategory.value = category
  form.categoryId = category.categoryId
  form.name = category.name
  form.description = category.description || ''
  formError.value = ''
  showFormModal.value = true
}

const closeFormModal = () => {
  if (saving.value) return
  showFormModal.value = false
  editingCategory.value = null
  resetForm()
}

const submitCategory = async () => {
  formError.value = ''
  successMessage.value = ''

  if (!form.name.trim()) {
    formError.value = 'Name is required'
    return
  }

  if (!editingCategory.value && !form.categoryId.trim()) {
    formError.value = 'Category ID is required'
    return
  }

  saving.value = true

  try {
    if (editingCategory.value) {
      const res = await updateCategory(editingCategory.value.categoryId, {
        name: form.name,
        description: form.description,
      })
      const updatedCategory = res.data.category
      categories.value = categories.value.map((category) =>
        category.categoryId === updatedCategory.categoryId ? updatedCategory : category
      )
      successMessage.value = 'Category updated successfully'
    } else {
      const res = await createCategory({
        categoryId: form.categoryId,
        name: form.name,
        description: form.description,
      })
      categories.value = [...categories.value, res.data.category].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      successMessage.value = 'Category created successfully'
    }

      showFormModal.value = false
      editingCategory.value = null
      resetForm()
  } catch (err) {
    formError.value = err?.response?.data?.message || 'Failed to save category'
  } finally {
    saving.value = false
  }
}

const openDeleteModal = (category) => {
  successMessage.value = ''
  categoryToDelete.value = category
}

const closeDeleteModal = () => {
  categoryToDelete.value = null
}

const confirmDelete = async () => {
  if (!categoryToDelete.value) return

  try {
    await deleteCategory(categoryToDelete.value.categoryId)
    categories.value = categories.value.filter(
      (category) => category.categoryId !== categoryToDelete.value.categoryId
    )
    successMessage.value = 'Category deleted successfully'
    closeDeleteModal()
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to delete category'
    closeDeleteModal()
  }
}

onMounted(loadCategories)
</script>
