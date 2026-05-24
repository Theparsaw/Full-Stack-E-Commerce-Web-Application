const Product = require("../models/Product");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const Wishlist = require("../models/Wishlist");
const Notification = require("../models/Notification")
const DiscountCampaign = require("../models/DiscountCampaign");
const { publishNotification } = require("../utils/notificationEvents");



// CREATE CAMPAIGN
const createCampaign = asyncHandler(async (req, res) => {
  const {
    name,
    productIds,
    discountPercentage,
    startDate,
    endDate,
  } = req.body;

  if (!productIds || productIds.length === 0) {
    throw new AppError(
      "At least one product must be selected",
      400,
      "NO_PRODUCTS_SELECTED"
    );
  }

  // Verify products exist
  const products = await Product.find({
    productId: { $in: productIds },
  });

  if (products.length !== productIds.length) {
    throw new AppError(
      "One or more products do not exist",
      400,
      "INVALID_PRODUCTS"
    );
  }

  const campaign = await DiscountCampaign.create({
    name,
    productIds,
    discountPercentage,
    startDate,
    endDate,
  });
  for (const productId of campaign.productIds) {

    const product = await Product.findOne({
      productId,
    });

    const wishlists = await Wishlist.find({
      "items.productId": productId,
    });

    for (const wishlist of wishlists) {

      const notification = await Notification.findOneAndUpdate(
        {
          userId: String(wishlist.userId),
          productId,
          campaignId: String(campaign._id),
        },
        {
          userId: String(wishlist.userId),
          productId,
          campaignId: String(campaign._id),

          productName:
            product?.model ||
            product?.name ||
            "Product",

          discountPercentage:
            campaign.discountPercentage,

          message:
            `${product?.model || "A wishlisted product"} is now ${campaign.discountPercentage}% off.`,

          isRead: false,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      publishNotification(notification);
    }
  }

  res.status(201).json({
    message: "Discount campaign created successfully",
    campaign,
  });
});

// GET ALL CAMPAIGNS
const getCampaigns = asyncHandler(async (_req, res) => {
  const campaigns = await DiscountCampaign.find()
    .sort({ createdAt: -1 });

  res.status(200).json(campaigns);
});

// UPDATE CAMPAIGN
const updateCampaign = asyncHandler(async (req, res) => {

  const campaign = await DiscountCampaign.findById(
    req.params.id
  );

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  const {
    name,
    productIds,
    discountPercentage,
    startDate,
    endDate,
  } = req.body;

  campaign.name = name;

  campaign.discountPercentage =
    discountPercentage;

  campaign.startDate = startDate;

  campaign.endDate = endDate;

  campaign.productIds = productIds;

  await campaign.save();
  for (const productId of productIds) {

    const product = await Product.findOne({
      productId,
    });

    const wishlists = await Wishlist.find({
      "items.productId": productId,
    });

    for (const wishlist of wishlists) {

      const notification = await Notification.findOneAndUpdate(
        {
          userId: String(wishlist.userId),
          productId,
          campaignId: String(campaign._id),
        },
        {
          userId: String(wishlist.userId),

          productId,

          campaignId: String(campaign._id),

          productName:
            product?.model ||
            product?.name ||
            "Product",

          discountPercentage:
            campaign.discountPercentage,

          message:
            `${product?.model || "A wishlisted product"} is now ${campaign.discountPercentage}% off.`,

          isRead: false,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      publishNotification(notification);
    }
  }

  return res.status(200).json(campaign);
});

// DEACTIVATE
const deactivateCampaign = asyncHandler(async (req, res) => {
  const campaign = await DiscountCampaign.findById(req.params.id);

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  campaign.isActive = false;

  await campaign.save();

  res.status(200).json({
    message: "Campaign deactivated successfully",
  });
});

const reactivateCampaign = asyncHandler(async (req, res) => {

  const campaign =
    await DiscountCampaign.findById(
      req.params.id
    );

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  campaign.isActive = true;

  await campaign.save();

  return res.status(200).json({
    message: "Campaign reactivated",
    campaign,
  });
});


const deleteCampaign = asyncHandler(async (req, res) => {

  const campaign =
    await DiscountCampaign.findById(
      req.params.id
    );

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  await campaign.deleteOne();

  return res.status(200).json({
    message: "Campaign deleted",
  });
});


module.exports = {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deactivateCampaign,
  reactivateCampaign,
  deleteCampaign,
};
