<template>
  <div>
    <div class="mb-6">
      <p class="text-sm font-semibold text-orange-600 mb-2">
        Pricing
      </p>

      <h1 class="text-3xl font-bold text-gray-900">
        Price Management
      </h1>

      <p class="text-gray-600 mt-2">
        Update product prices from the admin panel.
      </p>
    </div>

    <div class="mb-6 rounded-3xl border border-gray-200 bg-white p-4">
      <input
        v-model="searchTerm"
        type="text"
        placeholder="Search by product name or ID..."
        class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
      />
    </div>

    <div
      v-if="loading"
      class="rounded-3xl border border-gray-200 bg-white p-6 text-gray-600"
    >
      Loading products...
    </div>

    <div
      v-else-if="error"
      class="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-600"
    >
      {{ error }}
    </div>

    <div
      v-else
      class="rounded-3xl border border-gray-200 bg-white overflow-hidden"
    >
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-6 py-4 font-semibold text-gray-700">
              Product
            </th>

            <th class="text-left px-6 py-4 font-semibold text-gray-700">
              Category
            </th>

            <th class="text-left px-6 py-4 font-semibold text-gray-700">
              Current Price
            </th>

            <th class="text-left px-6 py-4 font-semibold text-gray-700">
              New Price
            </th>

            <th class="text-left px-6 py-4 font-semibold text-gray-700">
              Action
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="product in filteredProducts"
            :key="product.productId"
          >
            <td class="px-6 py-4">
              <p class="font-semibold text-gray-900">
                {{ product.name }} {{ product.model }}
              </p>

              <p class="text-gray-400 text-xs">
                {{ product.productId }}
              </p>
            </td>

            <td class="px-6 py-4 text-gray-600 capitalize">
              {{ product.categoryId }}
            </td>

            <td class="px-6 py-4 font-semibold text-gray-900">
              ${{ product.price.toFixed(2) }}
            </td>

            <td class="px-6 py-4">
              <input
                v-model="priceInputs[product.productId]"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter new price"
                class="w-32 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                :class="errors[product.productId] ? 'border-red-400' : ''"
              />

              <p
                v-if="errors[product.productId]"
                class="text-red-500 text-xs mt-1"
              >
                {{ errors[product.productId] }}
              </p>
            </td>

            <td class="px-6 py-4">
              <button
                @click="updatePrice(product)"
                :disabled="saving[product.productId]"
                class="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {{
                  saving[product.productId]
                    ? 'Saving...'
                    : 'Save'
                }}
              </button>

              <span
                v-if="success[product.productId]"
                class="ml-2 text-green-600 text-xs font-semibold"
              >
                ✓ Updated
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="filteredProducts.length === 0"
        class="p-8 text-center text-gray-500"
      >
        No products found.
      </div>
    </div>

    <!-- CAMPAIGN MANAGEMENT -->

    <div
      ref="campaignFormSection"
      class="mt-10 rounded-3xl border border-gray-200 bg-white p-6"
    >

      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">
          Discount Campaign Management
        </h2>

        <p class="text-gray-600 mt-2">
          Create and manage product discount campaigns.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">

        <input
          v-model="campaignForm.name"
          type="text"
          placeholder="Campaign name"
          class="rounded-2xl border border-gray-300 px-4 py-3"
        />

        <input
          v-model.number="campaignForm.discountPercentage"
          type="number"
          min="1"
          max="100"
          placeholder="Discount %"
          class="rounded-2xl border border-gray-300 px-4 py-3"
        />

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Campaign Start Date
          </label>

          <input
            v-model="campaignForm.startDate"
            type="date"
            class="w-full rounded-2xl border border-gray-300 px-4 py-3"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Campaign End Date
          </label>

          <input
            v-model="campaignForm.endDate"
            type="date"
            class="w-full rounded-2xl border border-gray-300 px-4 py-3"
          />
        </div>
      </div>

      <!-- PRODUCT SEARCH -->

      <div class="mt-6">
        <input
          v-model="campaignProductSearch"
          type="text"
          placeholder="Search products for campaign..."
          class="w-full rounded-2xl border border-gray-300 px-4 py-3"
        />
      </div>

      <!-- PRODUCT SELECT -->

      <div class="mt-6">
        <p class="text-sm font-semibold text-gray-700 mb-3">
          Select Products
        </p>

        <div class="max-h-60 overflow-y-auto rounded-2xl border border-gray-200 p-4 space-y-2">

          <label
            v-for="product in filteredCampaignProducts"
            :key="product.productId"
            class="flex items-center gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50"
          >
            <input
              v-model="campaignForm.productIds"
              :value="product.productId"
              type="checkbox"
            />

            <div>
              <p class="font-semibold text-gray-900">
                {{ product.name }} {{ product.model }}
              </p>

              <p class="text-xs text-gray-500">
                {{ product.productId }}
              </p>
            </div>
          </label>

        </div>
      </div>

      <!-- BUTTONS -->

      <div class="flex gap-3 mt-6">

        <button
          @click="handleSaveCampaign"
          :disabled="creatingCampaign"
          class="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {{
            creatingCampaign
              ? 'Saving...'
              : editingCampaignId
                ? 'Update Campaign'
                : 'Create Campaign'
          }}
        </button>

        <button
          v-if="editingCampaignId"
          @click="resetCampaignForm"
          class="rounded-2xl bg-gray-200 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-300"
        >
          Cancel Edit
        </button>

      </div>

      <p
        v-if="campaignSuccess"
        class="mt-3 text-sm text-green-600"
      >
        {{ campaignSuccess }}
      </p>

      <p
        v-if="campaignError"
        class="mt-3 text-sm text-red-600"
      >
        {{ campaignError }}
      </p>

      <!-- EXISTING CAMPAIGNS -->

      <div class="mt-10">
        <h3 class="text-xl font-bold text-gray-900 mb-4">
          Existing Campaigns
        </h3>

        <input
          v-model="campaignSearch"
          type="text"
          placeholder="Search campaigns by name..."
          class="w-full rounded-2xl border border-gray-300 px-4 py-3 mb-4"
        />

        <div
          v-if="loadingCampaigns"
          class="text-gray-500"
        >
          Loading campaigns...
        </div>

        <div
          v-else-if="campaigns.length === 0"
          class="text-gray-500"
        >
          No campaigns found.
        </div>

        <div
          v-else-if="filteredCampaigns.length === 0"
          class="text-gray-500"
        >
          No campaigns match your search.
        </div>

        <div v-else class="space-y-4">

          <div
            v-for="campaign in displayedCampaigns"
            :key="campaign._id"
            class="rounded-2xl border border-gray-200 p-5"
          >

            <div class="flex items-center justify-between">

              <div
                class="cursor-pointer select-none"
                @click="toggleCampaignProducts(campaign._id)"
                title="Click to view the products in this campaign"
              >
                <p class="font-bold text-gray-900">
                  {{ campaign.name }}
                </p>

                <p class="text-sm text-gray-600 mt-1">
                  {{ campaign.discountPercentage }}% discount
                  <span class="text-gray-400">·</span>
                  {{ (campaign.productIds || []).length }} product(s)
                </p>

                <p class="text-xs text-gray-500 mt-1">
                  {{ formatCampaignDate(campaign.startDate) }}
                  →
                  {{ formatCampaignDate(campaign.endDate) }}
                </p>
              </div>

                <div class="flex gap-2">

                  <button
                    @click="startEdit(campaign)"
                    class="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                  >
                    Edit
                  </button>

                  <button
                    v-if="campaign.isActive"
                    @click="handleDeactivateCampaign(campaign._id)"
                    class="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    Deactivate
                  </button>

                  <button
                    v-else
                    @click="handleReactivateCampaign(campaign._id)"
                    class="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
                  >
                    Reactivate
                  </button>

                  <button
                    @click="handleDeleteCampaign(campaign._id)"
                    class="rounded-xl bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                  >
                    Delete
                  </button>

                </div>

            </div>

            <!-- PRODUCTS IN THIS CAMPAIGN (toggle) -->
            <div
              v-if="expandedCampaigns[campaign._id]"
              class="mt-4 border-t border-gray-100 pt-4"
            >
              <p class="text-xs font-semibold text-gray-500 mb-2">
                Products in this campaign
              </p>

              <div
                v-if="(campaign.productIds || []).length === 0"
                class="text-sm text-gray-400"
              >
                No products.
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="productId in campaign.productIds"
                  :key="productId"
                  class="rounded-xl bg-gray-50 border border-gray-100 px-4 py-2 text-sm text-gray-800"
                >
                  {{ productLabel(productId) }}
                  <span class="text-gray-400 text-xs">({{ productId }})</span>
                </div>
              </div>
            </div>

          </div>

          <div
            v-if="filteredCampaigns.length > PAGE_SIZE"
            class="flex gap-3 pt-1"
          >
            <button
              v-if="visibleCampaignCount < filteredCampaigns.length"
              @click="visibleCampaignCount += PAGE_SIZE"
              type="button"
              class="text-sm font-semibold text-orange-600 hover:underline"
            >
              Show more ({{ filteredCampaigns.length - visibleCampaignCount }} more)
            </button>

            <button
              v-if="visibleCampaignCount > PAGE_SIZE"
              @click="visibleCampaignCount = PAGE_SIZE"
              type="button"
              class="text-sm font-semibold text-gray-500 hover:underline"
            >
              Show less
            </button>
          </div>

        </div>
      </div>

      <!-- PRODUCTS & THEIR CAMPAIGNS -->

      <div class="mt-10 border-t border-gray-200 pt-8">
        <h3 class="text-xl font-bold text-gray-900 mb-1">
          Products &amp; Their Campaigns
        </h3>

        <p class="text-sm text-gray-600 mb-4">
          See every campaign a product is included in. When campaigns overlap,
          the one that starts first applies.
        </p>

        <input
          v-model="productCampaignSearch"
          type="text"
          placeholder="Search products by name or ID..."
          class="w-full rounded-2xl border border-gray-300 px-4 py-3 mb-4"
        />

        <div
          v-if="filteredProductCampaigns.length === 0"
          class="text-gray-500"
        >
          No products found.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="row in displayedProductCampaigns"
            :key="row.productId"
            class="rounded-2xl border border-gray-200 p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-semibold text-gray-900">
                  {{ row.name }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ row.productId }}
                </p>
              </div>

              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="row.campaigns.length
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-500'"
              >
                {{ row.campaigns.length }} campaign(s)
              </span>
            </div>

            <div
              v-if="row.campaigns.length"
              class="mt-3 flex flex-wrap gap-2"
            >
              <span
                v-for="c in row.campaigns"
                :key="c._id"
                class="rounded-lg px-3 py-1.5 text-sm"
                :class="c.appliesFirst
                  ? 'bg-green-100 text-green-800 font-semibold'
                  : 'bg-gray-100 text-gray-700'"
              >
                {{ c.name }} ({{ c.discountPercentage }}%)
                <span class="text-xs text-gray-500">
                  {{ formatCampaignDate(c.startDate) }} → {{ formatCampaignDate(c.endDate) }}
                </span>
                <span
                  v-if="c.appliesFirst"
                  class="text-xs"
                >· applies first</span>
                <span
                  v-if="!c.isActive"
                  class="text-xs text-red-500"
                >· inactive</span>
              </span>
            </div>

            <p v-else class="mt-2 text-sm text-gray-400">
              Not in any campaign.
            </p>
          </div>

          <div
            v-if="filteredProductCampaigns.length > PAGE_SIZE"
            class="flex gap-3 pt-1"
          >
            <button
              v-if="visibleProductCampaignCount < filteredProductCampaigns.length"
              @click="visibleProductCampaignCount += PAGE_SIZE"
              type="button"
              class="text-sm font-semibold text-orange-600 hover:underline"
            >
              Show more ({{ filteredProductCampaigns.length - visibleProductCampaignCount }} more)
            </button>

            <button
              v-if="visibleProductCampaignCount > PAGE_SIZE"
              @click="visibleProductCampaignCount = PAGE_SIZE"
              type="button"
              class="text-sm font-semibold text-gray-500 hover:underline"
            >
              Show less
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- OVERLAP WARNING MODAL -->
    <div
      v-if="overlapWarning"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h3 class="text-xl font-bold text-gray-900">
          Overlapping campaign detected
        </h3>

        <p class="mt-2 text-sm text-gray-600">
          These products are already included in another active campaign that
          overlaps these dates:
        </p>

        <div class="mt-3 space-y-2">
          <div
            v-for="productId in overlapWarning.sharedProducts"
            :key="productId"
            class="rounded-xl bg-gray-50 border border-gray-100 px-4 py-2 text-sm text-gray-800"
          >
            {{ productLabel(productId) }}
            <span class="text-gray-400 text-xs">({{ productId }})</span>
          </div>
        </div>

        <p class="mt-4 text-sm text-gray-600">
          You can still continue — when campaigns overlap, the one that
          <strong>starts first</strong> applies to the product. If two
          campaigns have the <strong>same start date</strong>, the one that was
          <strong>created first</strong> applies. Application order:
        </p>

        <ol class="mt-3 space-y-2">
          <li
            v-for="(c, index) in overlapWarning.order"
            :key="c.key"
            class="rounded-xl border border-gray-200 px-4 py-3 text-sm"
            :class="index === 0 ? 'border-green-300 bg-green-50' : ''"
          >
            <span class="font-semibold text-gray-900">
              {{ index + 1 }}. {{ c.name }}
            </span>
            <span class="text-gray-600">
              — {{ c.discountPercentage }}%,
              {{ formatCampaignDate(c.startDate) }} → {{ formatCampaignDate(c.endDate) }}
            </span>
            <span v-if="c.isNew" class="text-blue-600 font-medium">
              (this campaign)
            </span>
            <span v-if="index === 0" class="text-green-700 font-semibold">
              · applies first
            </span>
            <span
              v-if="c.overlappingProductIds && c.overlappingProductIds.length"
              class="block text-xs text-gray-500 mt-1"
            >
              Shared products: {{ c.overlappingProductIds.map(productLabel).join(', ') }}
            </span>
          </li>
        </ol>

        <div class="mt-6 flex justify-end gap-3">
          <button
            @click="cancelOverlap"
            class="rounded-2xl bg-gray-200 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>

          <button
            @click="confirmOverlap"
            :disabled="creatingCampaign"
            class="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {{
              creatingCampaign
                ? 'Saving...'
                : editingCampaignId
                  ? 'Update Anyway'
                  : 'Create Anyway'
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  reactive,
  nextTick,
  watch
} from 'vue'

import {
  getProducts,
  updateProductPrice
} from '../../api/productApi'

import {
  getCampaigns,
  createCampaign,
  deactivateCampaign,
  reactivateCampaign,
  deleteCampaign,
  updateCampaign
} from '../../api/discountCampaignApi'

const products = ref([])
const campaigns = ref([])

const loading = ref(true)
const loadingCampaigns = ref(false)

const error = ref('')

const searchTerm = ref('')
const campaignProductSearch = ref('')

const editingCampaignId = ref(null)
const campaignFormSection = ref(null)

const creatingCampaign = ref(false)

const campaignSuccess = ref('')
const campaignError = ref('')

const priceInputs = reactive({})
const saving = reactive({})
const success = reactive({})
const errors = reactive({})

const campaignForm = ref({
  name: '',
  productIds: [],
  discountPercentage: 10,
  startDate: '',
  endDate: '',
})

// Which campaign cards are expanded to reveal their products
const expandedCampaigns = reactive({})

// Search box for the "Products & Their Campaigns" section
const productCampaignSearch = ref('')

// Search box for the "Existing Campaigns" list
const campaignSearch = ref('')

// Holds overlap details + computed application order when an overlap is detected
const overlapWarning = ref(null)

// How many items to reveal per "Show more" click
const PAGE_SIZE = 5
const visibleCampaignCount = ref(PAGE_SIZE)
const visibleProductCampaignCount = ref(PAGE_SIZE)

const filteredProducts = computed(() => {
  const term = searchTerm.value.toLowerCase()

  if (!term) return products.value

  return products.value.filter((p) =>
    `${p.name} ${p.model}`
      .toLowerCase()
      .includes(term)
    ||
    p.productId.toLowerCase().includes(term)
  )
})

const filteredCampaignProducts = computed(() => {
  return products.value.filter((p) =>
    `${p.name} ${p.model}`
      .toLowerCase()
      .includes(
        campaignProductSearch.value.toLowerCase()
      )
  )
})

// Human-friendly label for a productId (falls back to the id itself)
const productLabel = (productId) => {
  const product = products.value.find((p) => p.productId === productId)
  return product ? `${product.name} ${product.model}`.trim() : productId
}

const toggleCampaignProducts = (campaignId) => {
  expandedCampaigns[campaignId] = !expandedCampaigns[campaignId]
}

// Each product with the campaigns it belongs to, sorted so the earliest-start
// campaign is first. The campaign that currently applies (earliest-start,
// active, and in date range) is flagged with appliesFirst.
const filteredProductCampaigns = computed(() => {
  const term = productCampaignSearch.value.trim().toLowerCase()
  const nowTs = Date.now()

  const rows = products.value.map((product) => {
    const productCampaigns = campaigns.value
      .filter((campaign) =>
        (campaign.productIds || []).includes(product.productId)
      )
      .slice()
      .sort((a, b) => {
        const startDiff = new Date(a.startDate) - new Date(b.startDate)
        if (startDiff !== 0) return startDiff
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      })

    const applying = productCampaigns.find(
      (campaign) =>
        campaign.isActive &&
        new Date(campaign.startDate).getTime() <= nowTs &&
        new Date(campaign.endDate).getTime() >= nowTs
    )

    return {
      productId: product.productId,
      name: `${product.name} ${product.model}`.trim(),
      campaigns: productCampaigns.map((campaign) => ({
        ...campaign,
        appliesFirst: Boolean(applying) && campaign._id === applying._id,
      })),
    }
  })

  if (!term) return rows

  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(term) ||
      row.productId.toLowerCase().includes(term)
  )
})

// Campaigns filtered by the campaign search box (by name)
const filteredCampaigns = computed(() => {
  const term = campaignSearch.value.trim().toLowerCase()
  if (!term) return campaigns.value
  return campaigns.value.filter((campaign) =>
    (campaign.name || '').toLowerCase().includes(term)
  )
})

// Paginated slices for the "Show more" buttons
const displayedCampaigns = computed(() =>
  filteredCampaigns.value.slice(0, visibleCampaignCount.value)
)

const displayedProductCampaigns = computed(() =>
  filteredProductCampaigns.value.slice(0, visibleProductCampaignCount.value)
)

// Reset pagination when the relevant search term changes
watch(campaignSearch, () => {
  visibleCampaignCount.value = PAGE_SIZE
})

watch(productCampaignSearch, () => {
  visibleProductCampaignCount.value = PAGE_SIZE
})

const loadProducts = async () => {
  loading.value = true
  error.value = ''

  try {

    const res = await getProducts()

    products.value =
      (res.data || []).sort((a, b) =>
        `${a.name} ${a.model}`.localeCompare(
          `${b.name} ${b.model}`
        )
      )

  } catch (err) {

    error.value = 'Failed to load products'

  } finally {

    loading.value = false
  }
}

const loadCampaigns = async () => {
  loadingCampaigns.value = true

  try {

    const res = await getCampaigns()

    campaigns.value = res.data

  } catch (err) {

    console.error(err)

  } finally {

    loadingCampaigns.value = false
  }
}

const updatePrice = async (product) => {

  const raw = priceInputs[product.productId]

  errors[product.productId] = ''

  if (raw === undefined || raw === '') {
    errors[product.productId] =
      'Please enter a price'

    return
  }

  const newPrice = parseFloat(raw)

  if (isNaN(newPrice) || newPrice < 0) {

    errors[product.productId] =
      'Price must be positive'

    return
  }

  saving[product.productId] = true
  success[product.productId] = false

  try {

    await updateProductPrice(product.productId, newPrice)

    product.price = newPrice

    priceInputs[product.productId] = ''

    success[product.productId] = true

    setTimeout(() => {
      success[product.productId] = false
    }, 3000)

  } catch (err) {

    errors[product.productId] =
      'Failed to update price'

  } finally {

    saving[product.productId] = false
  }
}

const resetCampaignForm = () => {

  editingCampaignId.value = null

  campaignForm.value = {
    name: '',
    productIds: [],
    discountPercentage: 10,
    startDate: '',
    endDate: '',
  }
}

const startEdit = (campaign) => {

  editingCampaignId.value = campaign._id

  campaignForm.value = {
    name: campaign.name || "",

    productIds:
      campaign.productIds
      ||
      campaign.products?.map(
        (p) => p.productId || p
      )
      ||
      [],

    discountPercentage:
      campaign.discountPercentage || 0,

    startDate:
      campaign.startDate
        ? campaign.startDate.split("T")[0]
        : "",

    endDate:
      campaign.endDate
        ? campaign.endDate.split("T")[0]
        : "",
  }

  nextTick(() => {
    campaignFormSection.value?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  })
}
// Build the ordered warning list shown in the overlap modal: the existing
// overlapping campaigns plus the one being saved, sorted by start date so the
// admin can see which one applies first.
const buildOverlapWarning = (overlaps) => {
  const newEntry = {
    key: '__new__',
    name: campaignForm.value.name || 'New campaign',
    discountPercentage: campaignForm.value.discountPercentage,
    startDate: campaignForm.value.startDate,
    endDate: campaignForm.value.endDate,
    isNew: true,
  }

  const order = [
    ...overlaps.map((o) => ({ ...o, key: o.campaignId })),
    newEntry,
  ].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

  // Unique list of products that overlap with another campaign
  const sharedProducts = [
    ...new Set(
      overlaps.flatMap((o) => o.overlappingProductIds || [])
    ),
  ]

  overlapWarning.value = { order, sharedProducts }
}

const submitCampaign = async (force) => {

  creatingCampaign.value = true

  campaignSuccess.value = ''
  campaignError.value = ''

  const payload = { ...campaignForm.value, force }

  try {

    if (editingCampaignId.value) {

      await updateCampaign(
        editingCampaignId.value,
        payload
      )

      campaignSuccess.value =
        'Campaign updated successfully'

    } else {

      await createCampaign(payload)

      campaignSuccess.value =
        'Campaign created successfully'
    }

    overlapWarning.value = null

    resetCampaignForm()

    await loadCampaigns()

  } catch (err) {

    const data = err?.response?.data

    // Overlap is a warning, not a hard error: surface the confirm modal
    if (!force && data?.code === 'CAMPAIGN_OVERLAP_WARNING') {
      buildOverlapWarning(data.details?.overlaps || [])
      return
    }

    campaignError.value =
      data?.message
      ||
      'Failed to save campaign'

  } finally {

    creatingCampaign.value = false
  }
}

const handleSaveCampaign = () => submitCampaign(false)

const confirmOverlap = () => submitCampaign(true)

const cancelOverlap = () => {
  overlapWarning.value = null
}

const handleDeactivateCampaign = async (id) => {

  try {

    await deactivateCampaign(id)

    await loadCampaigns()

  } catch (err) {

    console.error(err)
  }
}

const formatCampaignDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const handleReactivateCampaign = async (id) => {

  try {

    await reactivateCampaign(id);

    await loadCampaigns();

  } catch (err) {

    console.error(err);
  }
}

const handleDeleteCampaign = async (id) => {

  const confirmed = confirm(
    "Delete this campaign permanently?"
  );

  if (!confirmed) return;

  try {

    await deleteCampaign(id);

    await loadCampaigns();

  } catch (err) {

    console.error(err);
  }
}

onMounted(async () => {

  await Promise.all([
    loadProducts(),
    loadCampaigns(),
  ])
})
</script>
