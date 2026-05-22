import axios from "axios";
import { authStore } from "../store/auth";
import { API_BASE_URL, resolveBackendAssetUrl } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const resolveAssetUrl = resolveBackendAssetUrl;

const normalizeProduct = (product) => {
  if (!product || typeof product !== "object") return product;
  return {
    ...product,
    imageUrl: resolveAssetUrl(product.imageUrl),
  };
};

const normalizeProductResponse = (response) => {
  if (Array.isArray(response.data)) {
    response.data = response.data.map(normalizeProduct);
  } else if (response.data?.product) {
    response.data.product = normalizeProduct(response.data.product);
  } else if (response.data?.productId) {
    response.data = normalizeProduct(response.data);
  }

  return response;
};

const buildProductPayload = (data) => {
  if (!data?.imageFile) return data;

  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (key === "imageFile" || value === undefined || value === null) return;
    formData.append(key, value);
  });

  formData.append("productImage", data.imageFile);
  return formData;
};

api.interceptors.request.use((config) => {
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const authErrorCodes = new Set([
      "AUTH_REQUIRED",
      "TOKEN_EXPIRED",
      "INVALID_TOKEN",
      "INVALID_TOKEN_FORMAT",
      "USER_NOT_FOUND",
    ]);

    if (authStore.token && authErrorCodes.has(error?.response?.data?.code)) {
      authStore.clearAuth();

      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.assign("/login?reason=session-expired");
      }
    }

    return Promise.reject(error);
  },
);

export const getProducts = (search = "", sort = "") => {
  const params = {};

  if (search && search.trim()) {
    params.search = search.trim();
  }

  if (sort && sort.trim()) {
    params.sort = sort.trim();
  }

  return api.get("/products", { params }).then(normalizeProductResponse);
};

export const getProductById = (id) =>
  api.get(`/products/${id}`).then(normalizeProductResponse);
export const createProduct = (data) =>
  api.post("/products", buildProductPayload(data)).then(normalizeProductResponse);
export const updateProduct = (id, data) =>
  api.put(`/products/${id}`, buildProductPayload(data)).then(normalizeProductResponse);
export const updateProductPrice = (id, price) =>
  api.put(`/products/${id}/price`, { price });
export const deleteProduct = (id) => api.delete(`/products/${id}`);

export default api;
