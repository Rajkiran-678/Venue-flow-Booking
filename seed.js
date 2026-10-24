require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Event = require("./models/Event");
const User = require("./models/User");

const samples = [
  {
    title: "Design Futures Summit", category: "Conference",
    description: "A full day of talks and hands-on sessions on product thinking, digital craft and the next wave of design.",
    date: "2027-01-16", time: "10:00 AM", venue: "T-Hub", city: "Hyderabad", price: 499, capacity: 180,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=85"
  },
  {
    title: "Indie Music Evening", category: "Music",
    description: "Discover independent artists, live instruments and a warm outdoor stage under the evening sky.",
    date: "2027-01-24", time: "6:30 PM", venue: "Heart Cup Coffee", city: "Hyderabad", price: 299, capacity: 120,
    image: "https://images.unsplash.com/photo-1659928005804-0ec9c656918f?auto=format&fit=crop&w=1200&q=85"
  },
  {
    title: "Build Something Weekend", category: "Workshop",
    description: "Bring an idea, meet curious builders and leave with a working first version of your project.",
    date: "2027-02-07", time: "9:30 AM", venue: "WE Hub", city: "Hyderabad", price: 199, capacity: 90,
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=85"
  },
  {
    title: "Canvas & Coffee", category: "Arts",
    description: "A relaxed beginner-friendly painting session with materials provided, good coffee and no pressure to be perfect.",
    date: "2027-02-14", time: "4:00 PM", venue: "The Art House", city: "Hyderabad", price: 349, capacity: 40,
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85"
  },
  {
    title: "Startup Stories Live", category: "Networking",
    description: "Hear honest founder stories about first customers, early mistakes and building products that people need.",
    date: "2027-02-21", time: "5:00 PM", venue: "Jubilee Hills Convention Centre", city: "Hyderabad", price: 0, capacity: 220,
    image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=85"
  },
  {
    title: "Sunrise Run Club", category: "Community",
    description: "An easy-paced community run for every level, followed by a casual cool-down and new connections.",
    date: "2027-03-01", time: "6:00 AM", venue: "Durgam Cheruvu Park", city: "Hyderabad", price: 99, capacity: 75,
    image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85"
  }
];

async function seedEvents() {
  const count = await Event.countDocuments();
  if (count) {
    console.log(`Sample events skipped: ${count} event(s) already exist.`);
    return;
  }
  await Event.insertMany(samples);
  console.log(`Added ${samples.length} sample events.`);
}

async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) {
    console.log("Admin setup skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in your private .env file to create the administrator account.");
    return;
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must contain at least 10 characters.");
  }

  let admin = await User.findOne({ email });
  if (!admin) {
    admin = await User.create({
      name: "VenueFlow Organizer",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin"
    });
    console.log(`Created organizer account for ${email}.`);
  } else {
    if (admin.role !== "admin") {
      admin.role = "admin";
      await admin.save();
    }
    console.log(`Organizer account already exists for ${email}; its password was not changed.`);
  }
}

async function seed() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Add your MongoDB Atlas connection string to .env before seeding.");
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await seedAdmin();
  await seedEvents();
  await mongoose.disconnect();
}

seed().catch(async function (error) {
  console.error("Seed failed:", error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
