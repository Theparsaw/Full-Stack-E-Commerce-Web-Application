// This script creates the default manager accounts in the database
// Run it ONCE from the terminal with: node seed/seedUsers.js
// You only need to run it again if you wipe the database

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const User = require("../models/User");

// Load environment variables from .env file (we need MONGO_URI)
dotenv.config();

const seedUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // ── Define the manager accounts we want to create ──────────────────────────

    const users = [
      {
        name: "Sales Manager",
        email: "salesmanager@store.com",
        password: "sales123",
        role: "sales_manager",
        taxId: "SM-001",
        address: "Store HQ",
      },
      {
        name: "Product Manager",
        email: "productmanager@store.com",
        password: "product123",
        role: "product_manager",
        taxId: "PM-001",
        address: "Store HQ",
      },
      {
        name: "Support Agent",
        email: "support@store.com",
        password: "support123",
        role: "support_agent",
        taxId: "SA-001",
        address: "Store HQ",
      },
    ];

    // ── Loop through each user and create them if they don't exist ─────────────

    for (const userData of users) {
      // Check if this email already exists in the database
      const existing = await User.findOne({ email: userData.email });

      if (existing) {
        // Skip if already there — so running the script twice doesn't cause errors
        console.log(`User already exists, skipping: ${userData.email}`);
        continue;
      }

      // Hash the password before saving — same as the register endpoint does
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create the user in the database
      await User.create({
        ...userData,
        password: hashedPassword,
      });

      console.log(`Created user: ${userData.email} (${userData.role})`);
    }

    console.log("Seeding complete!");

    // Close the database connection when done
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
};

// Run the function
seedUsers();
