<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div class="grid gap-8 xl:grid-cols-[minmax(640px,1fr)_minmax(360px,420px)] xl:items-start">
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block mb-1 font-medium">Product ID</label>
            <input
            v-model="form.productId"
            :disabled="disableProductId"
            class="w-full border rounded p-2 bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <p v-if="errors.productId" class="text-red-600 text-sm">{{ errors.productId }}</p>
          </div>

          <div>
            <label class="block mb-1 font-medium">Category</label>
            <select v-model="form.categoryId" class="w-full border rounded p-2">
              <option value="">Select category</option>
              <option v-for="cat in categories" :key="cat.categoryId" :value="cat.categoryId">
                {{ cat.name }}
              </option>
            </select>
            <p v-if="errors.categoryId" class="text-red-600 text-sm">{{ errors.categoryId }}</p>
          </div>

          <div>
            <label class="block mb-1 font-medium">Brand</label>
            <input v-model="form.name" class="w-full border rounded p-2" />
            <p v-if="errors.name" class="text-red-600 text-sm">{{ errors.name }}</p>
          </div>

          <div>
            <label class="block mb-1 font-medium">Model</label>
            <input v-model="form.model" class="w-full border rounded p-2" />
            <p v-if="errors.model" class="text-red-600 text-sm">{{ errors.model }}</p>
          </div>

          <div>
            <label class="block mb-1 font-medium">Serial Number</label>
            <input v-model="form.serialNumber" class="w-full border rounded p-2" />
            <p v-if="errors.serialNumber" class="text-red-600 text-sm">{{ errors.serialNumber }}</p>
          </div>

          <div>
            <label class="block mb-1 font-medium">Quantity In Stock</label>
            <input v-model.number="form.quantityInStock" type="number" min="0" class="w-full border rounded p-2" />
            <p v-if="errors.quantityInStock" class="text-red-600 text-sm">{{ errors.quantityInStock }}</p>
          </div>

          <div>
            <label class="block mb-1 font-medium">Warranty Status</label>
            <input v-model="form.warrantyStatus" class="w-full border rounded p-2" />
            <p v-if="errors.warrantyStatus" class="text-red-600 text-sm">{{ errors.warrantyStatus }}</p>
          </div>
        </div>

        <div>
          <label class="block mb-1 font-medium">Distributor Info</label>
          <input v-model="form.distributorInfo" class="w-full border rounded p-2" />
          <p v-if="errors.distributorInfo" class="text-red-600 text-sm">{{ errors.distributorInfo }}</p>
        </div>

        <div>
          <label class="block mb-1 font-medium">Description</label>
          <textarea v-model="form.description" rows="4" class="w-full border rounded p-2"></textarea>
          <p v-if="errors.description" class="text-red-600 text-sm">{{ errors.description }}</p>
        </div>
      </div>

      <aside class="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <label class="block mb-4 font-medium">Product Image</label>
        <div class="aspect-square overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white">
          <img
            v-if="imagePreviewUrl"
            :src="imagePreviewUrl"
            alt="Product image preview"
            class="h-full w-full object-contain p-3"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-sm text-gray-400">
            No image selected
          </div>
        </div>

        <p v-if="selectedImageFile" class="mt-3 truncate text-sm font-medium text-gray-700">
          {{ selectedImageFile.name }}
        </p>
        <p v-else-if="form.imageUrl" class="mt-3 text-sm font-medium text-gray-700">
          Current product image
        </p>
        <p class="mt-1 text-sm text-gray-500">PNG, JPG, or WebP up to 5MB.</p>
        <p v-if="errors.imageFile" class="mt-2 text-sm text-red-600">{{ errors.imageFile }}</p>

        <input
          ref="imageInput"
          type="file"
          accept="image/*"
          class="sr-only"
          @change="handleImageChange"
        />

        <div class="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            @click="openImagePicker"
          >
            Upload image
          </button>
          <button
            v-if="selectedImageFile"
            type="button"
            class="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            @click="clearSelectedImage"
          >
            Clear
          </button>
        </div>
      </aside>
    </div>

    <div class="flex gap-3">
      <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        {{ submitLabel }}
      </button>

      <button type="button" @click="$emit('cancel')" class="px-4 py-2 border rounded">
        Cancel
      </button>
    </div>
  </form>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

const props = defineProps({
  initialValues: {
    type: Object,
    default: () => ({
      productId: '',
      categoryId: '',
      name: '',
      model: '',
      serialNumber: '',
      description: '',
      quantityInStock: 0,
      warrantyStatus: '',
      distributorInfo: '',
      imageUrl: '',
    }),
  },
  submitLabel: {
    type: String,
    default: 'Save',
  },
  categories: {
    type: Array,
    default: () => [],
  },
  disableProductId: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['submit', 'cancel'])

const form = reactive({ ...props.initialValues })
const errors = reactive({})
const selectedImageFile = ref(null)
const localPreviewUrl = ref('')
const imageInput = ref(null)

const imagePreviewUrl = computed(() => localPreviewUrl.value || form.imageUrl || '')

const revokeLocalPreview = () => {
  if (localPreviewUrl.value) {
    window.URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = ''
  }
}

watch(
  () => props.initialValues,
  (newVal) => {
    Object.assign(form, newVal)
    selectedImageFile.value = null
    revokeLocalPreview()
  },
  { deep: true }
)

onBeforeUnmount(revokeLocalPreview)

const openImagePicker = () => {
  imageInput.value?.click()
}

const handleImageChange = (event) => {
  delete errors.imageFile

  const [file] = Array.from(event.target.files || [])
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errors.imageFile = 'Please choose a valid image file'
    event.target.value = ''
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    errors.imageFile = 'Product image must be smaller than 5MB'
    event.target.value = ''
    return
  }

  revokeLocalPreview()
  selectedImageFile.value = file
  localPreviewUrl.value = window.URL.createObjectURL(file)
}

const clearSelectedImage = () => {
  selectedImageFile.value = null
  revokeLocalPreview()
  if (imageInput.value) {
    imageInput.value.value = ''
  }
}

const validate = () => {
  Object.keys(errors).forEach((key) => delete errors[key])

  if (!form.productId) errors.productId = 'Product ID is required'
  if (!form.categoryId) errors.categoryId = 'Category is required'
  if (!form.name) errors.name = 'Brand is required'
  if (!form.model) errors.model = 'Model is required'
  if (!form.serialNumber) errors.serialNumber = 'Serial number is required'
  if (!form.description) errors.description = 'Description is required'
  if (form.quantityInStock === '' || form.quantityInStock < 0) errors.quantityInStock = 'Stock must be 0 or more'
  if (!form.warrantyStatus) errors.warrantyStatus = 'Warranty status is required'
  if (!form.distributorInfo) errors.distributorInfo = 'Distributor info is required'

  return Object.keys(errors).length === 0
}

const handleSubmit = () => {
  if (!validate()) return
  const { price: _price, ...productManagerFields } = form
  emit('submit', { ...productManagerFields, imageFile: selectedImageFile.value })
}
</script>
