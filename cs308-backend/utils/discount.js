const DiscountCampaign = require("../models/DiscountCampaign");

const getActiveCampaignsForProductIds = async (productIds, now = new Date()) => {
  const normalizedProductIds = [
    ...new Set(
      productIds
        .map((productId) => String(productId || "").trim())
        .filter(Boolean)
    ),
  ];

  if (normalizedProductIds.length === 0) {
    return [];
  }

  // Sort so that when a product belongs to several overlapping campaigns,
  // the one that STARTED first comes first (tie-break: created first).
  // findCampaignForProduct picks the first match, so this is the campaign
  // whose discount actually applies to the product.
  const query = DiscountCampaign.find({
    isActive: true,
    productIds: { $in: normalizedProductIds },
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ startDate: 1, createdAt: 1 });

  return typeof query.lean === "function" ? query.lean() : query;
};

const calculateDiscountedPrice = (product, campaign) => {
  if (!campaign) {
    return {
      originalPrice: product.price,
      discountedPrice: product.price,
      hasDiscount: false,
      discountPercentage: 0,
      campaignName: "",
      activeCampaignName: null,
    };
  }

  const discountedPrice =
    product.price * (1 - campaign.discountPercentage / 100);

  return {
    originalPrice: product.price,
    discountedPrice: Number(discountedPrice.toFixed(2)),
    hasDiscount: true,
    discountPercentage: campaign.discountPercentage,
    campaignName: campaign.name,
    activeCampaignName: campaign.name,
  };
};

const findCampaignForProduct = (campaigns, productId) =>
  campaigns.find((campaign) => campaign.productIds.includes(productId));

const enrichProductsWithDiscounts = async (products) => {
  const campaigns = await getActiveCampaignsForProductIds(
    products.map((product) => product.productId)
  );

  return products.map((product) => {
    const pricing = calculateDiscountedPrice(
      product,
      findCampaignForProduct(campaigns, product.productId)
    );

    return {
      ...product,
      originalPrice: pricing.originalPrice,
      discountedPrice: pricing.discountedPrice,
      hasDiscount: pricing.hasDiscount,
      discountPercentage: pricing.discountPercentage,
      campaignName: pricing.campaignName,
      activeCampaignName: pricing.activeCampaignName,
    };
  });
};

const getDiscountedPrice = async (product) => {
  const campaigns = await getActiveCampaignsForProductIds([product.productId]);
  return calculateDiscountedPrice(
    product,
    findCampaignForProduct(campaigns, product.productId)
  );
};

module.exports = {
  getDiscountedPrice,
  enrichProductsWithDiscounts,
};
