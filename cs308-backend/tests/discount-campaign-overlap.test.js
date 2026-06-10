const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const Product = require("../models/Product");
const DiscountCampaign = require("../models/DiscountCampaign");

// All campaigns created here share this name prefix so cleanup never touches
// real/seeded campaigns.
const CAMPAIGN_NAME_PREFIX = "ZZZ Camp Overlap Test";
const DAY = 24 * 60 * 60 * 1000;

// Unique-ish product ids so reruns don't collide with leftover data.
const stamp = Date.now();
const productIds = {
  overlap: `camptest-ovl-${stamp}`,
  order: `camptest-ord-${stamp}`,
  tie: `camptest-tie-${stamp}`,
  updateA: `camptest-upda-${stamp}`,
  updateB: `camptest-updb-${stamp}`,
};

let salesManagerToken;

const makeProduct = (productId) => ({
  productId,
  categoryId: "camp-test",
  name: "Campaign Test",
  model: `Model ${productId}`,
  serialNumber: `${productId}-serial`,
  description: "Campaign overlap test product",
  quantityInStock: 10,
  price: 100,
  warrantyStatus: "Test warranty",
  distributorInfo: "Test distributor",
});

const campaignPayload = (overrides = {}) => ({
  name: `${CAMPAIGN_NAME_PREFIX} ${Date.now()}`,
  productIds: [productIds.overlap],
  discountPercentage: 20,
  startDate: new Date(Date.now() - DAY).toISOString(),
  endDate: new Date(Date.now() + DAY).toISOString(),
  ...overrides,
});

const postCampaign = (payload) =>
  request(app)
    .post("/api/discount-campaigns")
    .set("Authorization", `Bearer ${salesManagerToken}`)
    .send(payload);

beforeAll(async () => {
  // Seeded sales manager (same credentials used by the other admin tests)
  const managerRes = await request(app).post("/api/auth/login").send({
    email: "salesmanager@store.com",
    password: "sales123",
  });
  salesManagerToken = managerRes.body.token;

  await Product.create(Object.values(productIds).map(makeProduct));
});

afterAll(async () => {
  await DiscountCampaign.deleteMany({
    name: { $regex: `^${CAMPAIGN_NAME_PREFIX}` },
  });
  await DiscountCampaign.deleteMany({
    productIds: { $in: Object.values(productIds) },
  });
  await Product.deleteMany({ productId: { $in: Object.values(productIds) } });
  await mongoose.connection.close();
});

describe("Discount campaign overlap warning (create)", () => {
  test("the first campaign on a product is created without any warning", async () => {
    const res = await postCampaign(campaignPayload({ discountPercentage: 20 }));

    expect(res.statusCode).toBe(201);
    expect(res.body.campaign.discountPercentage).toBe(20);
  });

  test("an overlapping campaign returns a 409 warning instead of a hard block", async () => {
    const res = await postCampaign(campaignPayload({ discountPercentage: 30 }));

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("CAMPAIGN_OVERLAP_WARNING");
    expect(Array.isArray(res.body.details.overlaps)).toBe(true);
    expect(res.body.details.overlaps.length).toBeGreaterThan(0);
    expect(res.body.details.overlaps[0].overlappingProductIds).toContain(
      productIds.overlap
    );
  });

  test("the overlapping campaign is created when force=true is sent", async () => {
    const res = await postCampaign(
      campaignPayload({ discountPercentage: 30, force: true })
    );

    expect(res.statusCode).toBe(201);
  });
});

describe("Overlapping campaign application order", () => {
  test("the earliest start date applies when campaigns overlap", async () => {
    await DiscountCampaign.create({
      name: `${CAMPAIGN_NAME_PREFIX} Early ${Date.now()}`,
      productIds: [productIds.order],
      discountPercentage: 10,
      startDate: new Date(Date.now() - 3 * DAY),
      endDate: new Date(Date.now() + 3 * DAY),
      isActive: true,
    });

    await DiscountCampaign.create({
      name: `${CAMPAIGN_NAME_PREFIX} Late ${Date.now()}`,
      productIds: [productIds.order],
      discountPercentage: 40,
      startDate: new Date(Date.now() - 1 * DAY),
      endDate: new Date(Date.now() + 3 * DAY),
      isActive: true,
    });

    const res = await request(app).get(`/api/products/${productIds.order}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hasDiscount).toBe(true);
    // The earlier-starting campaign (10%) wins over the later one (40%)
    expect(res.body.discountPercentage).toBe(10);
  });

  test("with identical start dates, the earliest-created campaign applies", async () => {
    const sameStart = new Date(Date.now() - 2 * DAY);
    const end = new Date(Date.now() + 3 * DAY);

    // Created first -> wins the createdAt tie-break
    await DiscountCampaign.create({
      name: `${CAMPAIGN_NAME_PREFIX} TieFirst ${Date.now()}`,
      productIds: [productIds.tie],
      discountPercentage: 15,
      startDate: sameStart,
      endDate: end,
      isActive: true,
    });

    // Created second -> same start date, but loses the tie-break
    await DiscountCampaign.create({
      name: `${CAMPAIGN_NAME_PREFIX} TieSecond ${Date.now()}`,
      productIds: [productIds.tie],
      discountPercentage: 45,
      startDate: sameStart,
      endDate: end,
      isActive: true,
    });

    const res = await request(app).get(`/api/products/${productIds.tie}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hasDiscount).toBe(true);
    // The first-created campaign (15%) wins the same-start-date tie-break
    expect(res.body.discountPercentage).toBe(15);
  });
});

describe("Discount campaign overlap warning (update)", () => {
  let campaignBId;

  test("two campaigns on different products are created without a warning", async () => {
    const resA = await postCampaign(
      campaignPayload({
        name: `${CAMPAIGN_NAME_PREFIX} UpdA ${Date.now()}`,
        productIds: [productIds.updateA],
        discountPercentage: 25,
      })
    );
    expect(resA.statusCode).toBe(201);

    const resB = await postCampaign(
      campaignPayload({
        name: `${CAMPAIGN_NAME_PREFIX} UpdB ${Date.now()}`,
        productIds: [productIds.updateB],
        discountPercentage: 35,
      })
    );
    expect(resB.statusCode).toBe(201);
    campaignBId = resB.body.campaign._id;
  });

  test("updating a campaign to overlap another product's campaign warns", async () => {
    const res = await request(app)
      .put(`/api/discount-campaigns/${campaignBId}`)
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        name: `${CAMPAIGN_NAME_PREFIX} UpdB ${Date.now()}`,
        productIds: [productIds.updateB, productIds.updateA],
        discountPercentage: 35,
        startDate: new Date(Date.now() - DAY).toISOString(),
        endDate: new Date(Date.now() + DAY).toISOString(),
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("CAMPAIGN_OVERLAP_WARNING");
    expect(res.body.details.overlaps[0].overlappingProductIds).toContain(
      productIds.updateA
    );
  });

  test("the update succeeds when force=true is sent", async () => {
    const res = await request(app)
      .put(`/api/discount-campaigns/${campaignBId}`)
      .set("Authorization", `Bearer ${salesManagerToken}`)
      .send({
        name: `${CAMPAIGN_NAME_PREFIX} UpdB ${Date.now()}`,
        productIds: [productIds.updateB, productIds.updateA],
        discountPercentage: 35,
        startDate: new Date(Date.now() - DAY).toISOString(),
        endDate: new Date(Date.now() + DAY).toISOString(),
        force: true,
      });

    expect(res.statusCode).toBe(200);
  });
});
