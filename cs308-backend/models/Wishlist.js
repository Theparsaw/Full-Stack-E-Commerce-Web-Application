const mongoose = require("mongoose");

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [wishlistItemSchema],
      default: [],
      validate: {
        validator(items) {
          const seenProductIds = new Set();

          for (const item of items) {
            const normalizedProductId = String(item.productId || "").trim();

            if (!normalizedProductId || seenProductIds.has(normalizedProductId)) {
              return false;
            }

            seenProductIds.add(normalizedProductId);
          }

          return true;
        },
        message: "Wishlist cannot contain duplicate products",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

wishlistSchema.pre("validate", function normalizeAndDedupeWishlist() {
  const seenProductIds = new Set();

  for (const item of this.items) {
    const normalizedProductId = String(item.productId || "").trim();

    if (!normalizedProductId) {
      throw new Error("Wishlist items require a productId");
    }

    if (seenProductIds.has(normalizedProductId)) {
      throw new Error("Wishlist cannot contain duplicate products");
    }

    item.productId = normalizedProductId;
    seenProductIds.add(normalizedProductId);
  }
});

wishlistSchema.virtual("products", {
  ref: "Product",
  localField: "items.productId",
  foreignField: "productId",
  justOne: false,
});

wishlistSchema.methods.removeUnavailableProductReferences = function removeUnavailableProductReferences(
  availableProductIds = []
) {
  const allowedProductIds = new Set(availableProductIds.map((productId) => String(productId).trim()));

  this.items = this.items.filter((item) => allowedProductIds.has(item.productId));
  return this;
};

wishlistSchema.statics.removeProductReferences = function removeProductReferences(productId) {
  return this.updateMany(
    {},
    {
      $pull: {
        items: {
          productId: String(productId).trim(),
        },
      },
    }
  );
};

wishlistSchema.index({ "items.productId": 1 });

module.exports = mongoose.model("Wishlist", wishlistSchema);
