import api, { resolveAssetUrl } from "./productApi";

const normalizeWishlistResponse = (response) => {
  if (Array.isArray(response.data?.items)) {
    response.data.items = response.data.items.map((item) => ({
      ...item,
      product: item.product
        ? {
            ...item.product,
            imageUrl: resolveAssetUrl(item.product.imageUrl),
          }
        : item.product,
    }));
  }

  return response;
};

export const getWishlist = () =>
  api.get("/wishlist").then(normalizeWishlistResponse);

export const addWishlistItem = (productId) =>
  api.post("/wishlist/items", { productId }).then(normalizeWishlistResponse);

export const removeWishlistItem = (productId) =>
  api.delete(`/wishlist/items/${productId}`).then(normalizeWishlistResponse);
