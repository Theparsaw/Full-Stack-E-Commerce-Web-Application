import { createRouter, createWebHistory } from 'vue-router'
import { authStore } from '../store/auth'

// Public pages
import ProductsPage from '../pages/ProductsPage.vue'
import ProductDetailPage from '../pages/ProductDetailPage.vue'
import CartPage from '../pages/CartPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'
import CheckoutPage from '../pages/CheckoutPage.vue'
import PaymentPage from '../pages/PaymentPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import NotificationsPage from '../pages/NotificationsPage.vue'
import MyReturnsPage from '../pages/MyReturnsPage.vue'

// Admin layout + pages
import AdminLayout from '../components/admin/AdminLayout.vue'
import AdminProductsPage from '../pages/admin/AdminProductsPage.vue'
import AddProductPage from '../pages/admin/AddProductPage.vue'
import EditProductPage from '../pages/admin/EditProductPage.vue'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.vue'
import AdminReviewsPage from '../pages/admin/AdminReviewsPage.vue'
import AdminStockPage from '../pages/admin/AdminStockPage.vue'
import SalesDeliveriesPage from '../pages/admin/SalesDeliveriesPage.vue'
import AdminCategoriesPage from '../pages/admin/AdminCategoriesPage.vue'
import SalesPricingPage from '../pages/admin/SalesPricingPage.vue'
import AdminRefundsPage from '../pages/admin/AdminRefundsPage.vue'
import SalesInvoicesPage from '../pages/admin/SalesInvoicesPage.vue'
import FinancialReportPage from '../pages/admin/FinancialReportPage.vue'

const adminAreaMeta = {
  requiresAuth: true,
  roles: ['sales_manager', 'product_manager'],
}

const productManagerMeta = {
  requiresAuth: true,
  roles: ['product_manager'],
}

const salesManagerMeta = {
  requiresAuth: true,
  roles: ['sales_manager'],
}

const routes = [
  { path: '/', component: ProductsPage },
  { path: '/products', redirect: '/' },
  { path: '/products/:id', component: ProductDetailPage },
  { path: '/cart', component: CartPage },
  { path: '/checkout', component: CheckoutPage, meta: { requiresAuth: true } },
  { path: '/payment/:orderId', component: PaymentPage, meta: { requiresAuth: true } },
  { path: '/login', component: LoginPage },
  { path: '/register', component: RegisterPage },
  { path: '/profile', component: ProfilePage, meta: { requiresAuth: true } },
  { path: "/notifications", component: NotificationsPage, meta: { requiresAuth: true } },
  { path: '/my-returns', component: MyReturnsPage, meta: { requiresAuth: true } },

  {
    path: '/admin',
    component: AdminLayout,
    meta: adminAreaMeta,
    children: [
      {
        path: '',
        redirect: () => {
          return authStore.role === 'sales_manager'
            ? '/admin/pricing'
            : '/admin/dashboard'
        },
      },
      {
        path: 'dashboard',
        component: AdminDashboardPage,
        meta: productManagerMeta,
      },
      {
        path: 'products',
        component: AdminProductsPage,
        meta: productManagerMeta,
      },
      {
        path: 'products/add',
        component: AddProductPage,
        meta: productManagerMeta,
      },
      {
        path: 'products/edit/:id',
        component: EditProductPage,
        meta: productManagerMeta,
      },
      {
        path: 'reviews',
        component: AdminReviewsPage,
        meta: productManagerMeta,
      },
      {
        path: 'stock',
        component: AdminStockPage,
        meta: productManagerMeta,
      },
      {
        path: 'categories',
        component: AdminCategoriesPage,
        meta: productManagerMeta,
      },
      {
        path: 'deliveries',
        component: SalesDeliveriesPage,
        meta: productManagerMeta,
      },
      {
        path: 'pricing',
        component: SalesPricingPage,
        meta: salesManagerMeta,
      },
      {
        path: 'returns',
        component: AdminRefundsPage,
        meta: salesManagerMeta,
      },
      {
        path: 'refunds',
        redirect: '/admin/returns',
        meta: salesManagerMeta,
      },
      {
        path: 'invoices',
        component: SalesInvoicesPage,
        meta: salesManagerMeta,
      },
      {
        path: 'financial-report',
        component: FinancialReportPage,
        meta: salesManagerMeta,
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth) {
    if (!authStore.isLoggedIn) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    }

    const allowedRoles = to.meta.roles || []

    if (allowedRoles.length > 0 && !allowedRoles.includes(authStore.role)) {
      if (authStore.role === 'sales_manager') {
        return next('/admin/pricing')
      }

      if (authStore.role === 'product_manager') {
        return next('/admin/dashboard')
      }

      return next('/')
    }
  }

  next()
})

export default router
