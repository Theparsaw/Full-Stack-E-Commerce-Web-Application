const Product = require("../models/Product");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const Wishlist = require("../models/Wishlist");
const Notification = require("../models/Notification");
const DiscountCampaign = require("../models/DiscountCampaign");
const User = require("../models/User");
const { sendDiscountNotificationEmail } = require("../utils/emailSender");
const { publishNotification } = require("../utils/notificationEvents");

// Find active campaigns whose date range overlaps the given range and that
// share at least one product. Used to warn the admin before allowing an
// overlapping campaign to be created/updated. `excludeId` skips the campaign
// being edited so it does not conflict with itself.
const findOverlappingCampaigns = async (
  productIds,
  startDate,
  endDate,
  excludeId = null
) => {
  const query = {
    isActive: true,
    productIds: { $in: productIds },
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const campaigns = await DiscountCampaign.find(query).sort({
    startDate: 1,
    createdAt: 1,
  });

  return campaigns.map((campaign) => ({
    campaignId: String(campaign._id),
    name: campaign.name,
    discountPercentage: campaign.discountPercentage,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    // Only the products shared with the campaign being saved are in conflict
    overlappingProductIds: campaign.productIds.filter((id) =>
      productIds.includes(id)
    ),
  }));
};

// CREATE CAMPAIGN
const createCampaign = asyncHandler(async (req, res) => {
  const {
    name,
    productIds,
    discountPercentage,
    startDate,
    endDate,
    force,
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

  // Warn (but do not block) when an active campaign overlaps this date range
  // for one or more of the same products. The admin can confirm by resending
  // with force=true. When campaigns overlap, the one that starts first applies.
  if (!force) {
    const overlaps = await findOverlappingCampaigns(
      productIds,
      startDate,
      endDate
    );

    if (overlaps.length > 0) {
      throw new AppError(
        "One or more products already have an overlapping active campaign in this date range. Confirm to create it anyway.",
        409,
        "CAMPAIGN_OVERLAP_WARNING",
        { overlaps }
      );
    }
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

      // Send email notification to the wishlist owner
      try {
        const customer = await User.findById(wishlist.userId).select("name email");
        if (customer) {
          await sendDiscountNotificationEmail(
            customer.email,
            customer.name,
            product?.model || product?.name || "A wishlisted product",
            campaign.discountPercentage,
            campaign.name
          );
        }
      } catch (emailError) {
        console.error("Discount email failed:", emailError);
      }
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
    force,
  } = req.body;

  // Warn (but do not block) when OTHER active campaigns overlap this date range
  // for the same products. The admin can confirm by resending with force=true.
  if (!force) {
    const overlaps = await findOverlappingCampaigns(
      productIds,
      startDate,
      endDate,
      campaign._id
    );

    if (overlaps.length > 0) {
      throw new AppError(
        "One or more products already have an overlapping active campaign in this date range. Confirm to update it anyway.",
        409,
        "CAMPAIGN_OVERLAP_WARNING",
        { overlaps }
      );
    }
  }

  campaign.name = name;
  campaign.discountPercentage = discountPercentage;
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
