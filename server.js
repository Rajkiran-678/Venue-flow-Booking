require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");

const User = require("./models/User");
const Event = require("./models/Event");
const Booking = require("./models/Booking");
const { requireAuth, requireAdmin } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = Boolean(process.env.VERCEL);
const MONGODB_URI = process.env.MONGODB_URI || (IS_VERCEL ? "" : "mongodb://127.0.0.1:27017/venueflow");
const SESSION_SECRET = process.env.SESSION_SECRET || (IS_VERCEL ? "" : "local-development-secret-change-this");

app.set("trust proxy", 1);
app.disable("x-powered-by");

// Local development serves pages here. On Vercel, files inside public/ are
// served by Vercel's static-file CDN; this middleware is still useful locally.
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

let databaseConnection = null;

async function connectDatabase() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }
  if (mongoose.connection.readyState === 1) return;

  // A single cached connection promise prevents every API call from opening
  // a new MongoDB connection in the same serverless function instance.
  if (!databaseConnection || mongoose.connection.readyState === 0) {
    databaseConnection = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    }).catch(function (error) {
      databaseConnection = null;
      throw error;
    });
  }
  await databaseConnection;
}

const sessionStore = MongoStore.create({
  mongoUrl: MONGODB_URI || "mongodb://127.0.0.1:27017/venueflow",
  collectionName: "sessions",
  ttl: 60 * 60 * 24 * 7,
  touchAfter: 24 * 3600
});

const sessionMiddleware = session({
  name: "venueflow.sid",
  secret: SESSION_SECRET || "missing-production-session-secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_VERCEL || process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
});

// Make database/configuration failures readable to the frontend instead of
// letting login/register hang or return a generic HTML error page.
app.use("/api", async function (req, res, next) {
  if (IS_VERCEL && (!process.env.MONGODB_URI || !process.env.SESSION_SECRET)) {
    return res.status(503).json({
      message: "The server is not configured yet. Add MONGODB_URI and SESSION_SECRET in Vercel → Project Settings → Environment Variables, then redeploy."
    });
  }

  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    res.status(503).json({
      message: "The shared database is unavailable. Check MONGODB_URI, Atlas Network Access, and the database user's credentials in Vercel."
    });
  }
});

app.use("/api", sessionMiddleware);

function getSafeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function saveSession(req, res, statusCode, payload) {
  req.session.save(function (error) {
    if (error) {
      console.error("Session save failed:", error.message);
      return res.status(500).json({ message: "Your details were accepted, but the login session could not be saved. Please try signing in again." });
    }
    res.status(statusCode).json(payload);
  });
}

function makeBookingCode() {
  return "VF-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkEventForm(data) {
  const requiredFields = ["title", "category", "description", "date", "time", "venue", "city"];
  for (const field of requiredFields) {
    if (!String(data[field] || "").trim()) return "Please fill in all required event details.";
  }
  if (String(data.title).trim().length > 120) return "Event name must be 120 characters or fewer.";
  if (String(data.description).trim().length > 1200) return "Description must be 1,200 characters or fewer.";
  if (!Number.isFinite(Number(data.price)) || Number(data.price) < 0) return "Ticket price must be zero or more.";
  if (!Number.isInteger(Number(data.capacity)) || Number(data.capacity) < 1) return "Ticket capacity must be a positive whole number.";
  if (Number.isNaN(new Date(data.date).getTime())) return "Please enter a valid event date.";
  const image = String(data.image || "").trim();
  if (image && !image.startsWith("./") && !/^https?:\/\//i.test(image)) {
    return "Use an image URL starting with https:// or a local path starting with ./";
  }
  return "";
}

// -------------------- HEALTH AND ACCOUNT ROUTES --------------------
app.get("/api/health", function (req, res) {
  res.json({ ok: true, database: "connected", message: "VenueFlow API is ready." });
});

app.get("/api/auth/me", function (req, res) {
  res.json({ user: req.session.user || null });
});

app.post("/api/auth/register", async function (req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: "Name must contain between 2 and 80 characters." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: "Password must contain between 8 and 128 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // Public signup must never grant admin privileges. The owner creates the
    // admin once with the seed script and the private ADMIN_EMAIL setting.
    const user = await User.create({ name, email, passwordHash, role: "user" });
    req.session.user = getSafeUser(user);
    saveSession(req, res, 201, { user: req.session.user, message: "Your account has been created." });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: "This email is already registered. Please sign in." });
    }
    next(error);
  }
});

app.post("/api/auth/login", async function (req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    req.session.regenerate(function (sessionError) {
      if (sessionError) return next(sessionError);
      req.session.user = getSafeUser(user);
      saveSession(req, res, 200, { user: req.session.user, message: "You are now signed in." });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", function (req, res, next) {
  req.session.destroy(function (error) {
    if (error) return next(error);
    res.clearCookie("venueflow.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_VERCEL || process.env.NODE_ENV === "production"
    });
    res.json({ message: "You have signed out." });
  });
});

// -------------------- EVENTS --------------------
app.get("/api/events", async function (req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filter = { date: { $gte: today } };

    if (req.query.category && req.query.category !== "All events") {
      filter.category = String(req.query.category).slice(0, 50);
    }
    if (req.query.search) {
      const searchText = escapeRegex(String(req.query.search).trim().slice(0, 80));
      filter.$or = ["title", "venue", "city", "category"].map(function (field) {
        return { [field]: { $regex: searchText, $options: "i" } };
      });
    }

    const events = await Event.find(filter).sort({ date: 1 }).lean();
    events.forEach(function (event) {
      event.availableSeats = Math.max(0, Number(event.capacity) - Number(event.bookedSeats || 0));
    });
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events/:id", async function (req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid event id." });
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ message: "Event not found." });
    event.availableSeats = Math.max(0, Number(event.capacity) - Number(event.bookedSeats || 0));
    res.json({ event });
  } catch (error) {
    next(error);
  }
});

// -------------------- TICKET BOOKING --------------------
app.post("/api/bookings", requireAuth, async function (req, res, next) {
  let reservedEventId = null;
  let reservedSeats = 0;
  try {
    const eventId = req.body.eventId;
    const seats = Number(req.body.seats);
    if (!mongoose.isValidObjectId(eventId)) return res.status(400).json({ message: "Please choose an event." });
    if (!Number.isInteger(seats) || seats < 1 || seats > 10) return res.status(400).json({ message: "Choose between 1 and 10 tickets." });

    // Atomic reservation: simultaneous visitors cannot book beyond capacity.
    const event = await Event.findOneAndUpdate(
      { _id: eventId, $expr: { $lte: [{ $add: ["$bookedSeats", seats] }, "$capacity"] } },
      { $inc: { bookedSeats: seats } },
      { new: true }
    );
    if (!event) return res.status(409).json({ message: "Not enough tickets are available. Please refresh the page." });
    reservedEventId = event._id;
    reservedSeats = seats;

    const booking = await Booking.create({
      bookingCode: makeBookingCode(),
      user: req.session.user.id,
      event: event._id,
      seats,
      totalAmount: seats * event.price
    });
    res.status(201).json({ booking, message: "Your tickets are confirmed." });
  } catch (error) {
    if (reservedEventId && reservedSeats) {
      try { await Event.updateOne({ _id: reservedEventId }, { $inc: { bookedSeats: -reservedSeats } }); }
      catch (rollbackError) { console.error("Booking rollback failed:", rollbackError.message); }
    }
    next(error);
  }
});

app.get("/api/bookings/mine", requireAuth, async function (req, res, next) {
  try {
    const bookings = await Booking.find({ user: req.session.user.id })
      .populate("event")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bookings/:id", requireAuth, async function (req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking reference." });
    const booking = await Booking.findOne({ _id: req.params.id, user: req.session.user.id }).populate("event").lean();
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings/:id/cancel", requireAuth, async function (req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking reference." });

    // Only one concurrent cancellation can change confirmed -> cancelled.
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.session.user.id, status: "confirmed" },
      { $set: { status: "cancelled" } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: "Active booking not found, or it has already been cancelled." });

    const released = await Event.updateOne(
      { _id: booking.event, bookedSeats: { $gte: booking.seats } },
      { $inc: { bookedSeats: -booking.seats } }
    );
    if (released.modifiedCount !== 1) {
      await Booking.updateOne({ _id: booking._id, status: "cancelled" }, { $set: { status: "confirmed" } });
      return res.status(409).json({ message: "The event ticket count could not be updated. Please try again or contact the organizer." });
    }
    res.json({ message: "Booking cancelled. The tickets are available again." });
  } catch (error) {
    next(error);
  }
});

// -------------------- ADMIN DASHBOARD AND REPORTS --------------------
app.get("/api/admin/summary", requireAdmin, async function (req, res, next) {
  try {
    const events = await Event.countDocuments();
    const users = await User.countDocuments({ role: "user" });
    const admins = await User.countDocuments({ role: "admin" });
    const confirmedBookings = await Booking.countDocuments({ status: "confirmed" });
    const totals = await Booking.aggregate([
      { $match: { status: "confirmed" } },
      { $group: { _id: null, bookingValue: { $sum: "$totalAmount" }, confirmedTickets: { $sum: "$seats" } } }
    ]);
    res.json({ summary: {
      events,
      users,
      admins,
      confirmedBookings,
      confirmedTickets: totals.length ? totals[0].confirmedTickets : 0,
      bookingValue: totals.length ? totals[0].bookingValue : 0
    } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", requireAdmin, async function (req, res, next) {
  try {
    // Never send password hashes to the browser.
    const users = await User.find({}, "name email role createdAt").sort({ createdAt: -1 }).lean();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/events", requireAdmin, async function (req, res, next) {
  try {
    const events = await Event.find().sort({ date: 1 }).lean();
    events.forEach(function (event) {
      event.availableSeats = Math.max(0, Number(event.capacity) - Number(event.bookedSeats || 0));
    });
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/events", requireAdmin, async function (req, res, next) {
  try {
    const problem = checkEventForm(req.body);
    if (problem) return res.status(400).json({ message: problem });

    const event = await Event.create({
      title: String(req.body.title).trim(),
      category: String(req.body.category).trim(),
      description: String(req.body.description).trim(),
      date: req.body.date,
      time: String(req.body.time).trim(),
      venue: String(req.body.venue).trim(),
      city: String(req.body.city).trim(),
      price: Number(req.body.price),
      capacity: Number(req.body.capacity),
      image: String(req.body.image || "").trim(),
      bookedSeats: 0,
      createdBy: req.session.user.id
    });
    res.status(201).json({ event, message: "Event added successfully." });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/events/:id", requireAdmin, async function (req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid event id." });
    const problem = checkEventForm(req.body);
    if (problem) return res.status(400).json({ message: problem });

    const capacity = Number(req.body.capacity);
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, bookedSeats: { $lte: capacity } },
      { $set: {
        title: String(req.body.title).trim(),
        category: String(req.body.category).trim(),
        description: String(req.body.description).trim(),
        date: req.body.date,
        time: String(req.body.time).trim(),
        venue: String(req.body.venue).trim(),
        city: String(req.body.city).trim(),
        price: Number(req.body.price),
        capacity,
        image: String(req.body.image || "").trim()
      } },
      { new: true, runValidators: true }
    );

    if (!event) {
      const existing = await Event.findById(req.params.id).select("bookedSeats").lean();
      if (!existing) return res.status(404).json({ message: "Event not found." });
      return res.status(400).json({ message: "Capacity cannot be lower than the number of tickets already booked." });
    }
    res.json({ event, message: "Event updated successfully." });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/events/:id", requireAdmin, async function (req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid event id." });
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found." });
    if (event.bookedSeats > 0) return res.status(409).json({ message: "This event has bookings. Resolve them before deleting the event." });
    await Event.deleteOne({ _id: event._id });
    res.json({ message: "Event deleted successfully." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/bookings", requireAdmin, async function (req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("event", "title date time venue city")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

app.use("/api", function (req, res) {
  res.status(404).json({ message: "API route not found." });
});

app.use(function (error, req, res, next) {
  console.error("VenueFlow request failed:", error && error.stack ? error.stack : error);
  if (res.headersSent) return next(error);
  if (error && error.code === 11000) return res.status(409).json({ message: "That record already exists. Please refresh and try again." });
  if (error && error.name === "ValidationError") return res.status(400).json({ message: "Some details are not valid. Check the form and try again." });
  res.status(500).json({ message: "The server could not complete the request. Check Vercel Runtime Logs for details." });
});

// Vercel imports the Express app; local `npm start` starts a normal server.
if (require.main === module) {
  connectDatabase().then(function () {
    app.listen(PORT, function () {
      console.log("VenueFlow is running at http://localhost:" + PORT);
    });
  }).catch(function (error) {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  });
}

module.exports = app;
