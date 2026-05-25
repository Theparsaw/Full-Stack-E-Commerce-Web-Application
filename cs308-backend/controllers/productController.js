const Product = require("../models/Product");
const Order = require("../models/Order");
const Review = require("../models/Review");
const fs = require("fs/promises");
const path = require("path");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { uploadProductImageToCloudinary } = require("../utils/cloudinary");
const {
  enrichProductsWithDiscounts,
  getDiscountedPrice,
} = require("../utils/discount");

const deleteLocalProductImage = async (imagePath) => {
  if (!imagePath || !imagePath.startsWith("/uploads/product-images/")) {
    return;
  }

  const fullPath = path.join(__dirname, "..", imagePath.replace(/^\//, ""));

  try {
    await fs.unlink(fullPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to delete old product image:", error);
    }
  }
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SEARCH_TERM_LIMIT = 12;
const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const normalizeSearchTerms = (search) => {
  const terms = String(search)
    .toLowerCase()
    .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g);

  if (!terms) return [];

  return [...new Set(terms)]
    .filter((term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term))
    .slice(0, SEARCH_TERM_LIMIT);
};

const buildRegexFallbackFilter = (search) => {
  const terms = normalizeSearchTerms(search).map((term) => escapeRegex(term));

  if (terms.length === 0) return {};

  return {
    $and: terms.map((term) => {
      const regex = new RegExp(term, "i");
      return {
        $or: [
          { name: regex },
          { model: regex },
          { description: regex },
          { categoryId: regex },
          { productId: regex },
        ],
      };
    }),
  };
};

const getAtlasMinimumShouldMatch = (search) => {
  const terms = normalizeSearchTerms(search);

  if (terms.length <= 2) return 1;

  return Math.ceil(terms.length * 0.6);
};

const buildAtlasSearchShouldClauses = (search) => {
  const terms = normalizeSearchTerms(search);
  const textPaths = ["name", "model", "description", "categoryId", "productId"];
  const should = [
    {
      autocomplete: {
        query: search,
        path: "name",
        fuzzy: { maxEdits: 1, prefixLength: 1 },
      },
    },
    {
      autocomplete: {
        query: search,
        path: "model",
        fuzzy: { maxEdits: 1, prefixLength: 1 },
      },
    },
    {
      text: {
        query: search,
        path: textPaths,
        fuzzy: { maxEdits: 1, prefixLength: 1 },
      },
    },
  ];

  terms.forEach((term) => {
    should.push({
      text: {
        query: term,
        path: textPaths,
        fuzzy: { maxEdits: 1, prefixLength: 1 },
      },
    });
  });

  return should;
};

const mergeProductsById = (...productLists) => {
  const productsById = new Map();

  productLists.flat().forEach((product) => {
    if (!productsById.has(product.productId)) {
      productsById.set(product.productId, product);
    }
  });

  return Array.from(productsById.values());
};

const buildPopularityStages = () => [
  {
    $lookup: {
      from: Order.collection.name,
      let: { currentProductId: "$productId" },
      pipeline: [
        { $match: { status: "paid" } },
        { $unwind: "$items" },
        {
          $match: {
            $expr: {
              $eq: ["$items.productId", "$$currentProductId"],
            },
          },
        },
        {
          $group: {
            _id: null,
            soldQuantity: { $sum: "$items.quantity" },
          },
        },
      ],
      as: "popularityStats",
    },
  },
  {
    $addFields: {
      popularity: {
        $ifNull: [{ $first: "$popularityStats.soldQuantity" }, 0],
      },
    },
  },
  {
    $project: {
      popularityStats: 0,
    },
  },
];

const buildRatingStages = () => [
  {
    $lookup: {
      from: Review.collection.name,
      let: { currentProductId: "$productId" },
      pipeline: [
        {
          $match: {
            status: "approved",
            rating: { $gte: 1, $lte: 5 },
            $expr: {
              $eq: ["$productId", "$$currentProductId"],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
      ],
      as: "ratingStats",
    },
  },
  {
    $addFields: {
      averageRating: {
        $round: [{ $ifNull: [{ $first: "$ratingStats.averageRating" }, 0] }, 1],
      },
      reviewCount: {
        $ifNull: [{ $first: "$ratingStats.reviewCount" }, 0],
      },
    },
  },
  {
    $project: {
      ratingStats: 0,
    },
  },
];

const buildSortStage = (sort, hasSearchScore = false) => {
  if (sort === "price_asc") return { $sort: { price: 1, createdAt: -1 } };
  if (sort === "price_desc") return { $sort: { price: -1, createdAt: -1 } };
  if (sort === "newest") return { $sort: { createdAt: -1 } };
  if (sort === "popularity") {
    return { $sort: { popularity: -1, createdAt: -1 } };
  }

  return hasSearchScore
    ? { $sort: { score: -1, createdAt: -1 } }
    : { $sort: { productId: 1 } };
};

const sortByDisplayPrice = (products, sort) => {
  if (sort !== "price_asc" && sort !== "price_desc") {
    return products;
  }

  const direction = sort === "price_asc" ? 1 : -1;

  return [...products].sort((left, right) => {
    const leftPrice = Number(left.discountedPrice ?? left.price);
    const rightPrice = Number(right.discountedPrice ?? right.price);
    const priceDifference = (leftPrice - rightPrice) * direction;

    if (priceDifference !== 0) {
      return priceDifference;
    }

    return new Date(right.createdAt ?? 0) - new Date(left.createdAt ?? 0);
  });
};

const getAllProducts = asyncHandler(async (req, res) => {
  const rawSearch = req.query.search;
  const search = typeof rawSearch === "string" ? rawSearch.trim() : "";

  const validSortOptions = ["price_asc", "price_desc", "popularity", "newest"];
  const rawSort = req.query.sort;
  const sort = validSortOptions.includes(rawSort) ? rawSort : null;

  // No search: return all products with sort applied
  if (!search) {
    const products = await Product.aggregate([
      ...buildPopularityStages(),
      ...buildRatingStages(),
      buildSortStage(sort),
    ]);

    const productsWithDiscounts = await enrichProductsWithDiscounts(products);

    return res.status(200).json(sortByDisplayPrice(productsWithDiscounts, sort));
  }

  // Search with sort applied
  try {
    const atlasResults = await Product.aggregate([
      {
        $search: {
          index: "product_search",
          compound: {
            should: buildAtlasSearchShouldClauses(search),
            minimumShouldMatch: getAtlasMinimumShouldMatch(search),
          },
        },
      },
      { $addFields: { score: { $meta: "searchScore" } } },
      ...buildPopularityStages(),
      ...buildRatingStages(),
      buildSortStage(sort, true),
    ]);

    const fallbackFilter = buildRegexFallbackFilter(search);
    const fallbackResults = await Product.aggregate([
      { $match: fallbackFilter },
      ...buildPopularityStages(),
      ...buildRatingStages(),
      buildSortStage(sort),
    ]);
    const combinedResults = mergeProductsById(fallbackResults, atlasResults);

    if (combinedResults.length > 0) {
      const productsWithDiscounts =
        await enrichProductsWithDiscounts(combinedResults);

      return res.status(200).json(sortByDisplayPrice(productsWithDiscounts, sort));
    }

    return res.status(200).json([]);

  } catch (error) {
    // Safe fallback if Atlas Search is unavailable
    const fallbackFilter = buildRegexFallbackFilter(search);
    const products = await Product.aggregate([
      { $match: fallbackFilter },
      ...buildPopularityStages(),
      ...buildRatingStages(),
      buildSortStage(sort),
    ]);
    const productsWithDiscounts = await enrichProductsWithDiscounts(products);

    return res.status(200).json(sortByDisplayPrice(productsWithDiscounts, sort));
  }
});

const getProductById = asyncHandler(async (req, res) => {
  const [product] = await Product.aggregate([
    { $match: { productId: req.params.id } },
    ...buildPopularityStages(),
    ...buildRatingStages(),
  ]);

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  const pricing = await getDiscountedPrice(product);

  res.status(200).json({
    ...product,
    originalPrice: pricing.originalPrice,
    discountedPrice: pricing.discountedPrice,
    hasDiscount: pricing.hasDiscount,
    discountPercentage: pricing.discountPercentage,
    campaignName: pricing.campaignName,
    activeCampaignName: pricing.activeCampaignName,
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const {
    productId,
    categoryId,
    name,
    model,
    serialNumber,
    description,
    quantityInStock,
    price,
    warrantyStatus,
    distributorInfo,
    imageUrl,
  } = req.body;

  const existingProductId = await Product.findOne({ productId });
  if (existingProductId) {
    throw new AppError(
      "A product with this productId already exists",
      400,
      "DUPLICATE_PRODUCT_ID"
    );
  }

  const existingSerialNumber = await Product.findOne({ serialNumber });
  if (existingSerialNumber) {
    throw new AppError(
      "A product with this serial number already exists",
      400,
      "DUPLICATE_SERIAL_NUMBER"
    );
  }

  const uploadedImage = req.file
    ? await uploadProductImageToCloudinary(req.file)
    : null;
  const productImageUrl = uploadedImage?.secure_url || imageUrl;

  const product = await Product.create({
    productId,
    categoryId,
    name,
    model,
    serialNumber,
    description,
    quantityInStock,
    price,
    warrantyStatus,
    distributorInfo,
    imageUrl: productImageUrl,
  });

  res.status(201).json({
    message: "Product created successfully",
    product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const {
    categoryId,
    name,
    model,
    serialNumber,
    description,
    quantityInStock,
    price,
    warrantyStatus,
    distributorInfo,
    imageUrl,
  } = req.body;

  const product = await Product.findOne({ productId: req.params.id });

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  if (serialNumber && serialNumber !== product.serialNumber) {
    const serialExists = await Product.findOne({ serialNumber });
    if (serialExists) {
      throw new AppError(
        "Another product already uses this serial number",
        400,
        "DUPLICATE_SERIAL_NUMBER"
      );
    }
  }

  product.categoryId = categoryId ?? product.categoryId;
  product.name = name ?? product.name;
  product.model = model ?? product.model;
  product.serialNumber = serialNumber ?? product.serialNumber;
  product.description = description ?? product.description;
  product.quantityInStock = quantityInStock ?? product.quantityInStock;
  product.price = price ?? product.price;
  product.warrantyStatus = warrantyStatus ?? product.warrantyStatus;
  product.distributorInfo = distributorInfo ?? product.distributorInfo;

  if (req.file) {
    const uploadedImage = await uploadProductImageToCloudinary(req.file);
    await deleteLocalProductImage(product.imageUrl);
    product.imageUrl = uploadedImage.secure_url;
  } else if (imageUrl !== undefined) {
    product.imageUrl = imageUrl;
  }

  const updatedProduct = await product.save();

  res.status(200).json({
    message: "Product updated successfully",
    product: updatedProduct,
  });
});
const updateProductPrice = asyncHandler(async (req, res) => {
  const allowedFields = ["price"];
  const receivedFields = Object.keys(req.body);

  const hasInvalidField = receivedFields.some(
    (field) => !allowedFields.includes(field)
  );

  if (hasInvalidField) {
    throw new AppError(
      "Only price can be updated from this endpoint",
      400,
      "PRICE_ONLY_ENDPOINT"
    );
  }

  const { price } = req.body;

  if (price === undefined || price === null || price === "") {
    throw new AppError("Price is required", 400, "PRICE_REQUIRED");
  }

  const numericPrice = Number(price);

  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    throw new AppError(
      "Price must be a non-negative number",
      400,
      "INVALID_PRICE"
    );
  }

  const product = await Product.findOne({ productId: req.params.id });

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  product.price = numericPrice;

  const updatedProduct = await product.save();

  res.status(200).json({
    message: "Product price updated successfully",
    product: updatedProduct,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ productId: req.params.id });

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  await product.deleteOne();

  res.status(200).json({
    message: "Product deleted successfully",
  });
});

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  updateProductPrice,
  deleteProduct,
};
