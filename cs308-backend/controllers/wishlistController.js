const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { enrichProductsWithDiscounts } = require("../utils/discount");

const sanitizeProduct = (product) => {
  return {
    id: product._id,
    productId: product.productId,
    categoryId: product.categoryId,
    name: product.name,
    model: product.model,
    description: product.description,
    quantityInStock: product.quantityInStock,
    price: product.price,
    warrantyStatus: product.warrantyStatus,
    distributorInfo: product.distributorInfo,
    imageUrl: product.imageUrl || "",
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,

    hasDiscount:
      !!product.discountPercentage,

    discountPercentage:
      product.discountPercentage || 0,

    originalPrice:
      product.originalPrice || product.price,

    discountedPrice:
      product.discountedPrice || product.price,

    activeCampaignName:
      product.activeCampaignName || null,
  };
};

const serializeWishlist = (wishlist, productsById = {}) => ({
  id: wishlist._id,
  userId: wishlist.userId,
  items: wishlist.items
    .map((item) => {
      const product = productsById[item.productId];

      if (!product) {
        return null;
      }

      return {
        productId: item.productId,
        addedAt: item.addedAt,
        product: sanitizeProduct(product),
      };
    })
    .filter(Boolean),
  totalItems: wishlist.items.filter((item) => productsById[item.productId]).length,
  createdAt: wishlist.createdAt,
  updatedAt: wishlist.updatedAt,
});

const getEmptyWishlistPayload = (userId) => ({
  userId,
  items: [],
  totalItems: 0,
});

const getProductsById = async (productIds) => {
  if (!productIds.length) {
    return {};
  }

  const products = await Product.find({
    productId: { $in: productIds },
  }).lean();

  const productsWithDiscounts = await enrichProductsWithDiscounts(products);

  const productsById = {};

  for (const product of productsWithDiscounts) {
    productsById[product.productId] = product;
  }

  return productsById;
};

const syncUnavailableWishlistItems = async (wishlist) => {
  const productIds = wishlist.items.map((item) => item.productId);
  const productsById = await getProductsById(productIds);
  const availableProductIds = Object.keys(productsById);

  if (availableProductIds.length !== productIds.length) {
    wishlist.removeUnavailableProductReferences(availableProductIds);
    await wishlist.save();
  }

  return productsById;
};

const findOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      userId,
      items: [],
    });
  }

  return wishlist;
};

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ userId: req.user.id });

  if (!wishlist) {
    return res.status(200).json(getEmptyWishlistPayload(req.user.id));
  }

  const productsById = await syncUnavailableWishlistItems(wishlist);

  return res.status(200).json(serializeWishlist(wishlist, productsById));
});

const addWishlistItem = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId || !String(productId).trim()) {
    throw new AppError("productId is required", 400, "VALIDATION_ERROR");
  }

  const normalizedProductId = String(productId).trim();
  const product = await Product.findOne({ productId: normalizedProductId }).lean();

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  const wishlist = await findOrCreateWishlist(req.user.id);
  const alreadyExists = wishlist.items.some((item) => item.productId === normalizedProductId);

  if (alreadyExists) {
    throw new AppError(
      "Product is already in the wishlist",
      409,
      "WISHLIST_ITEM_ALREADY_EXISTS"
    );
  }

  wishlist.items.push({
    productId: normalizedProductId,
  });
  await wishlist.save();
  const productsById = await syncUnavailableWishlistItems(wishlist);

  return res.status(201).json(serializeWishlist(wishlist, productsById));
});

const removeWishlistItem = asyncHandler(async (req, res) => {
  const normalizedProductId = String(req.params.productId || "").trim();

  if (!normalizedProductId) {
    throw new AppError("productId is required", 400, "VALIDATION_ERROR");
  }

  const wishlist = await Wishlist.findOne({ userId: req.user.id });

  if (!wishlist) {
    throw new AppError("Wishlist item not found", 404, "WISHLIST_ITEM_NOT_FOUND");
  }

  const itemExists = wishlist.items.some((item) => item.productId === normalizedProductId);

  if (!itemExists) {
    throw new AppError("Wishlist item not found", 404, "WISHLIST_ITEM_NOT_FOUND");
  }

  wishlist.items = wishlist.items.filter((item) => item.productId !== normalizedProductId);
  await wishlist.save();

  const productsById = await syncUnavailableWishlistItems(wishlist);

  return res.status(200).json(serializeWishlist(wishlist, productsById));
});

module.exports = {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
};
