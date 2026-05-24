const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const Order = require("../models/Order");
const Product = require("../models/Product");
const DiscountCampaign = require("../models/DiscountCampaign");

const popularityTestCartPrefix = `sort-test-cart-${Date.now()}`;
const displayPriceSearchTerm = `Display Price Sort ${Date.now()}`;
const displayPriceProductIds = [
  `display-price-sort-expensive-${Date.now()}`,
  `display-price-sort-cheap-${Date.now()}`,
];

const getDisplayPrice = (product) =>
  Number(product.discountedPrice ?? product.price);

beforeAll(async () => {
  await Order.insertMany([
    {
      userId: "sort-test-user-1",
      cartId: `${popularityTestCartPrefix}-1`,
      items: [
        {
          productId: "p001",
          name: "Apple",
          unitPrice: 1299,
          quantity: 5,
        },
      ],
      totalPrice: 6495,
      status: "paid",
    },
    {
      userId: "sort-test-user-2",
      cartId: `${popularityTestCartPrefix}-2`,
      items: [
        {
          productId: "p001",
          name: "Apple",
          unitPrice: 1299,
          quantity: 2,
        },
        {
          productId: "p002",
          name: "Samsung",
          unitPrice: 999,
          quantity: 3,
        },
      ],
      totalPrice: 5595,
      status: "paid",
    },
    {
      userId: "sort-test-user-3",
      cartId: `${popularityTestCartPrefix}-3`,
      items: [
        {
          productId: "p002",
          name: "Samsung",
          unitPrice: 999,
          quantity: 9,
        },
      ],
      totalPrice: 8991,
      status: "pending_payment",
    },
  ]);

  await Product.insertMany([
    {
      productId: displayPriceProductIds[0],
      categoryId: "sort-test",
      name: "Sort Test",
      model: `${displayPriceSearchTerm} Premium`,
      serialNumber: `${displayPriceProductIds[0]}-serial`,
      description: displayPriceSearchTerm,
      quantityInStock: 5,
      price: 1000,
      warrantyStatus: "Test warranty",
      distributorInfo: "Test distributor",
    },
    {
      productId: displayPriceProductIds[1],
      categoryId: "sort-test",
      name: "Sort Test",
      model: `${displayPriceSearchTerm} Standard`,
      serialNumber: `${displayPriceProductIds[1]}-serial`,
      description: displayPriceSearchTerm,
      quantityInStock: 5,
      price: 600,
      warrantyStatus: "Test warranty",
      distributorInfo: "Test distributor",
    },
  ]);

  await DiscountCampaign.create({
    name: `Test Campaign Display Price Sort ${Date.now()}`,
    productIds: [displayPriceProductIds[0]],
    discountPercentage: 70,
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
  });
});

afterAll(async () => {
  await Order.deleteMany({ cartId: { $regex: `^${popularityTestCartPrefix}` } });
  await DiscountCampaign.deleteMany({ productIds: { $in: displayPriceProductIds } });
  await Product.deleteMany({ productId: { $in: displayPriceProductIds } });
  await mongoose.connection.close();
});

describe("Product Sorting API", () => {

  // price_asc
  test("GET /api/products?sort=price_asc should return products sorted cheapest first", async () => {
    const res = await request(app).get("/api/products?sort=price_asc");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // Each product should be cheaper than or equal to the next one
    for (let i = 0; i < res.body.length - 1; i++) {
      expect(getDisplayPrice(res.body[i])).toBeLessThanOrEqual(getDisplayPrice(res.body[i + 1]));
    }
  });

  test("GET /api/products?sort=price_asc first product should be the cheapest", async () => {
    const res = await request(app).get("/api/products?sort=price_asc");

    expect(res.statusCode).toBe(200);
    const cheapestDisplayPrice = Math.min(...res.body.map(getDisplayPrice));
    expect(getDisplayPrice(res.body[0])).toBe(cheapestDisplayPrice);
  });

  // price_desc
  test("GET /api/products?sort=price_desc should return products most expensive first", async () => {
    const res = await request(app).get("/api/products?sort=price_desc");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // Each product should be more expensive than or equal to the next one
    for (let i = 0; i < res.body.length - 1; i++) {
      expect(getDisplayPrice(res.body[i])).toBeGreaterThanOrEqual(getDisplayPrice(res.body[i + 1]));
    }
  });

  test("GET /api/products?sort=price_desc first product should be the most expensive", async () => {
    const res = await request(app).get("/api/products?sort=price_desc");

    expect(res.statusCode).toBe(200);
    expect(res.body[0].price).toBe(2499); // Sony A7 IV
    expect(res.body[0].productId).toBe("p041");
  });

  // popularity
  test("GET /api/products?sort=popularity should return products with popularity", async () => {
    const res = await request(app).get("/api/products?sort=popularity");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    res.body.forEach((product) => {
      expect(product).toHaveProperty("popularity");
      expect(typeof product.popularity).toBe("number");
    });
  });

  test("GET /api/products?sort=popularity should sort by sold quantity from paid orders only", async () => {
    const res = await request(app).get("/api/products?sort=popularity");

    expect(res.statusCode).toBe(200);
    const p001 = res.body.find((product) => product.productId === "p001");
    expect(p001).toBeDefined();
    expect(p001.popularity).toBeGreaterThanOrEqual(7);

    for (let i = 0; i < res.body.length - 1; i++) {
      expect(res.body[i].popularity).toBeGreaterThanOrEqual(res.body[i + 1].popularity);
    }
  });

  test("GET /api/products should attach popularity values to product responses", async () => {
    const res = await request(app).get("/api/products");

    expect(res.statusCode).toBe(200);

    const product = res.body.find((item) => item.productId === "p001");
    expect(product).toBeDefined();
    expect(product.popularity).toBeGreaterThanOrEqual(7);
  });

  // invalid sort
  test("GET /api/products?sort=invalid should ignore sort and return all 50 products", async () => {
    const res = await request(app).get("/api/products?sort=invalid");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(50);
  });

  // search + sort combined
  test("GET /api/products?search=Samsung&sort=price_desc should return Samsung products most expensive first", async () => {
    const res = await request(app).get("/api/products?search=Samsung&sort=price_desc");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // All results should be Samsung
    res.body.forEach((product) => {
      const combined = `${product.name} ${product.model} ${product.description}`.toLowerCase();
      expect(combined).toContain("samsung");
    });

    // Should be sorted by display price descending
    for (let i = 0; i < res.body.length - 1; i++) {
      expect(getDisplayPrice(res.body[i])).toBeGreaterThanOrEqual(getDisplayPrice(res.body[i + 1]));
    }
  });

  test("GET /api/products?search=Samsung&sort=price_asc should return Samsung products cheapest first", async () => {
    const res = await request(app).get("/api/products?search=Samsung&sort=price_asc");

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (let i = 0; i < res.body.length - 1; i++) {
      expect(getDisplayPrice(res.body[i])).toBeLessThanOrEqual(getDisplayPrice(res.body[i + 1]));
    }
  });

  test("GET /api/products?sort=price_asc should sort discounted products by displayed price", async () => {
    const res = await request(app).get(
      `/api/products?search=${encodeURIComponent(displayPriceSearchTerm)}&sort=price_asc`
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.map((product) => product.productId)).toEqual([
      displayPriceProductIds[0],
      displayPriceProductIds[1],
    ]);
    expect(getDisplayPrice(res.body[0])).toBe(300);
    expect(getDisplayPrice(res.body[1])).toBe(600);
  });

  test("GET /api/products?search=Apple&sort=popularity should keep popularity sorting with search", async () => {
    const res = await request(app).get("/api/products?search=Apple&sort=popularity");

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (let i = 0; i < res.body.length - 1; i++) {
      expect(res.body[i].popularity).toBeGreaterThanOrEqual(res.body[i + 1].popularity);
    }
  });

});
