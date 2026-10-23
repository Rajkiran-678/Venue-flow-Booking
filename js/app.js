// VenueFlow demo app
// This version uses browser localStorage instead of a server or database.
// It is suitable for a student demo, not real accounts or real ticket sales.

const STORAGE_KEYS = {
  users: "venueflow_users",
  events: "venueflow_events",
  bookings: "venueflow_bookings",
  currentUser: "venueflow_current_user"
};

const defaultImage = "./images/hero-concert.jpg";
let signedInUser = null;

const sampleEvents = [
  {
    id: "event-1", title: "Design Futures Summit", category: "Conference",
    description: "A full day of talks and hands-on sessions on product thinking, digital craft and the next wave of design.",
    date: "2027-01-16", time: "10:00 AM", venue: "T-Hub", city: "Hyderabad",
    price: 499, capacity: 180, bookedSeats: 0,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "event-2", title: "Indie Music Evening", category: "Music",
    description: "Discover independent artists, live instruments and a warm outdoor stage under the evening sky.",
    date: "2027-01-24", time: "6:30 PM", venue: "Heart Cup Coffee", city: "Hyderabad",
    price: 299, capacity: 120, bookedSeats: 0,
    image: "https://images.unsplash.com/photo-1659928005804-0ec9c656918f?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "event-3", title: "Build Something Weekend", category: "Workshop",
    description: "Bring an idea, meet curious builders and leave with a working first version of your project.",
    date: "2027-02-07", time: "9:30 AM", venue: "WE Hub", city: "Hyderabad",
    price: 199, capacity: 90, bookedSeats: 0,
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "event-4", title: "Canvas & Coffee", category: "Arts",
    description: "A relaxed beginner-friendly painting session with materials provided, good coffee and no pressure to be perfect.",
    date: "2027-02-14", time: "4:00 PM", venue: "The Art House", city: "Hyderabad",
    price: 349, capacity: 40, bookedSeats: 0,
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "event-5", title: "Startup Stories Live", category: "Networking",
    description: "Hear honest founder stories about first customers, early mistakes and building products that people need.",
    date: "2027-02-21", time: "5:00 PM", venue: "Jubilee Hills Convention Centre", city: "Hyderabad",
    price: 0, capacity: 220, bookedSeats: 0,
    image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "event-6", title: "Sunrise Run Club", category: "Community",
    description: "An easy-paced community run for every level, followed by a casual cool-down and new connections.",
    date: "2027-03-01", time: "6:00 AM", venue: "Durgam Cheruvu Park", city: "Hyderabad",
    price: 99, capacity: 75, bookedSeats: 0,
    image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85"
  }
];

function readData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer)).map(function (byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

async function initializeStorage() {
  // Keep these same storage keys so existing data on this exact website URL remains available.
  const storedEvents = localStorage.getItem(STORAGE_KEYS.events);
  const storedUsers = localStorage.getItem(STORAGE_KEYS.users);
  const storedBookings = localStorage.getItem(STORAGE_KEYS.bookings);

  if (storedEvents === null) saveData(STORAGE_KEYS.events, sampleEvents);
  if (storedUsers === null) saveData(STORAGE_KEYS.users, []);
  if (storedBookings === null) saveData(STORAGE_KEYS.bookings, []);

  // Repair invalid or incomplete storage without overwriting valid saved records.
  const events = readData(STORAGE_KEYS.events, null);
  const users = readData(STORAGE_KEYS.users, null);
  const bookings = readData(STORAGE_KEYS.bookings, null);
  if (!Array.isArray(events)) saveData(STORAGE_KEYS.events, sampleEvents);
  if (!Array.isArray(users)) saveData(STORAGE_KEYS.users, []);
  if (!Array.isArray(bookings)) saveData(STORAGE_KEYS.bookings, []);

  // Demonstration admin account. Browser-only authentication is not secure for real services.
  const savedUsers = readData(STORAGE_KEYS.users, []);
  const adminEmail = "admin@venueflow.demo";
  const adminHash = await hashPassword("VenueFlow2026!");
  const adminIndex = savedUsers.findIndex(function (user) {
    return String(user.email || "").toLowerCase() === adminEmail;
  });
  const demoAdmin = {
    id: adminIndex >= 0 && savedUsers[adminIndex].id ? savedUsers[adminIndex].id : "demo-admin",
    name: "VenueFlow Organizer",
    email: adminEmail,
    passwordHash: adminHash,
    role: "admin",
    createdAt: adminIndex >= 0 && savedUsers[adminIndex].createdAt ? savedUsers[adminIndex].createdAt : new Date().toISOString()
  };
  if (adminIndex >= 0) savedUsers[adminIndex] = Object.assign({}, savedUsers[adminIndex], demoAdmin);
  else savedUsers.push(demoAdmin);
  saveData(STORAGE_KEYS.users, savedUsers);

  // Recalculate seats from confirmed bookings. This prevents event seat counts drifting after cancels/imports.
  syncBookedSeats();
}

function loadCurrentUser() {
  const currentUserId = localStorage.getItem(STORAGE_KEYS.currentUser);
  const users = readData(STORAGE_KEYS.users, []);
  signedInUser = users.find(function (user) { return user.id === currentUserId; }) || null;
}

function getUsers() { return readData(STORAGE_KEYS.users, []); }
function getEvents() { return readData(STORAGE_KEYS.events, []); }
function getBookings() { return readData(STORAGE_KEYS.bookings, []); }

function syncBookedSeats() {
  const events = getEvents();
  const bookings = getBookings();
  events.forEach(function (event) {
    event.bookedSeats = bookings.reduce(function (total, booking) {
      return total + (booking.eventId === event.id && booking.status === "confirmed" ? Number(booking.seats || 0) : 0);
    }, 0);
  });
  saveData(STORAGE_KEYS.events, events);
}

function escapeText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showPrice(price) {
  if (Number(price) === 0) return "Free";
  return "Rs. " + Number(price).toLocaleString("en-IN");
}

function showDate(dateValue) {
  if (!dateValue) return "Date to be announced";
  const date = new Date(String(dateValue).slice(0, 10) + "T00:00:00");
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getFormValues(form) {
  const values = {};
  new FormData(form).forEach(function (value, name) { values[name] = value; });
  return values;
}

function getUpcomingEvents() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getEvents().filter(function (event) {
    return new Date(event.date + "T00:00:00") >= today;
  }).sort(function (a, b) { return a.date.localeCompare(b.date); });
}

function getEventById(id) {
  return getEvents().find(function (event) { return event.id === id; });
}

function makeEventCard(event) {
  const eventLink = "./event.html?id=" + encodeURIComponent(event.id);
  const availableSeats = Math.max(0, Number(event.capacity) - Number(event.bookedSeats || 0));
  return `
    <div class="event-card">
      <a href="${eventLink}"><img class="event-image" src="${escapeText(event.image || defaultImage)}" alt="Photo for ${escapeText(event.title)}"></a>
      <div class="event-info">
        <span class="event-category">${escapeText(event.category)}</span>
        <h3><a href="${eventLink}">${escapeText(event.title)}</a></h3>
        <p class="event-date">${escapeText(showDate(event.date))} &middot; ${escapeText(event.time)}</p>
        <p class="event-location">${escapeText(event.venue)}, ${escapeText(event.city)}</p>
        <div class="event-bottom"><span class="event-price">${escapeText(showPrice(event.price))}</span><a href="${eventLink}">View event &rarr;</a></div>
        <p class="event-location">${availableSeats} tickets left</p>
      </div>
    </div>`;
}

function updateNavigation() {
  const accountLinks = document.getElementById("account-links");
  const adminLink = document.getElementById("admin-link");
  if (accountLinks) {
    if (signedInUser) {
      accountLinks.innerHTML = `<span class="welcome-text">Hi, ${escapeText(signedInUser.name)}</span><button class="small-button" id="logout-button" type="button">Log out</button>`;
      document.getElementById("logout-button").addEventListener("click", function () {
        localStorage.removeItem(STORAGE_KEYS.currentUser);
        signedInUser = null;
        window.location.href = "./index.html";
      });
    } else {
      accountLinks.innerHTML = '<a href="./login.html">Log in</a><a class="button button-small" href="./register.html">Sign up</a>';
    }
  }
  if (adminLink) adminLink.style.display = signedInUser && signedInUser.role === "admin" ? "inline" : "none";
}

function loadHomeEvents() {
  const eventArea = document.getElementById("featured-events");
  if (!eventArea) return;
  const events = getUpcomingEvents().slice(0, 3);
  eventArea.innerHTML = events.length
    ? events.map(makeEventCard).join("")
    : '<p class="empty-message">No upcoming events yet. Please check back soon.</p>';
}

function loadAllEvents() {
  const eventArea = document.getElementById("all-events");
  if (!eventArea) return;
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const query = new URLSearchParams(window.location.search);
  if (searchInput) searchInput.value = query.get("search") || "";
  if (categoryFilter) categoryFilter.value = query.get("category") || "All events";

  function searchEvents(event) {
    if (event) event.preventDefault();
    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const category = categoryFilter ? categoryFilter.value : "All events";
    let events = getUpcomingEvents();
    if (category && category !== "All events") {
      events = events.filter(function (item) { return item.category === category; });
    }
    if (searchText) {
      events = events.filter(function (item) {
        const searchable = [item.title, item.venue, item.city, item.category, item.description].join(" ").toLowerCase();
        return searchable.includes(searchText);
      });
    }
    const count = document.getElementById("event-count");
    if (count) count.textContent = events.length + " event(s) found";
    eventArea.innerHTML = events.length
      ? events.map(makeEventCard).join("")
      : '<p class="empty-message">No events matched that search. Try another word or category.</p>';
  }
  const searchForm = document.getElementById("event-search");
  if (searchForm) searchForm.addEventListener("submit", searchEvents);
  if (searchInput) searchInput.addEventListener("input", function () { searchEvents(); });
  if (categoryFilter) categoryFilter.addEventListener("change", function () { searchEvents(); });
  searchEvents();
}

function loadEventDetails() {
  const detailArea = document.getElementById("event-detail");
  if (!detailArea) return;
  const eventId = new URLSearchParams(window.location.search).get("id");
  const event = getEventById(eventId);
  if (!event) {
    detailArea.innerHTML = '<p class="empty-message">This event was not found. <a href="./events.html">Choose another event</a>.</p>';
    return;
  }
  const availableSeats = Math.max(0, Number(event.capacity) - Number(event.bookedSeats || 0));
  const loginNext = "./event.html?id=" + encodeURIComponent(event.id);
  detailArea.innerHTML = `
    <div class="event-detail">
      <div>
        <img class="detail-image" src="${escapeText(event.image || defaultImage)}" alt="Photo for ${escapeText(event.title)}">
        <div class="detail-box"><p><strong>About this event</strong></p><p>${escapeText(event.description)}</p></div>
      </div>
      <div class="detail-copy">
        <span class="event-category">${escapeText(event.category)}</span><h1>${escapeText(event.title)}</h1>
        <p class="detail-description">Make time for something new and meet people who share your interests.</p>
        <div class="detail-box">
          <p><strong>Date:</strong> ${escapeText(showDate(event.date))}</p><p><strong>Time:</strong> ${escapeText(event.time)}</p>
          <p><strong>Venue:</strong> ${escapeText(event.venue)}, ${escapeText(event.city)}</p><p><strong>Tickets left:</strong> ${availableSeats}</p>
          <p class="detail-price">${escapeText(showPrice(event.price))} <span>per ticket</span></p>
          <form id="book-form">
            <label>Number of tickets<select name="seats" id="ticket-count">${Array.from({ length: Math.min(10, availableSeats) }, function (_, index) { return '<option value="' + (index + 1) + '">' + (index + 1) + '</option>'; }).join("")}</select></label>
            <button class="button" type="submit" ${availableSeats < 1 ? "disabled" : ""}>Book tickets</button><p class="form-message" id="book-message"></p>
          </form>
          ${signedInUser ? "" : '<p class="event-location">You will need to <a href="./login.html?next=' + encodeURIComponent(loginNext) + '">log in</a> before booking.</p>'}
        </div>
      </div>
    </div>`;

  document.getElementById("book-form").addEventListener("submit", function (formEvent) {
    formEvent.preventDefault();
    if (!signedInUser) {
      window.location.href = "./login.html?next=" + encodeURIComponent(loginNext);
      return;
    }
    const seats = Number(document.getElementById("ticket-count").value);
    const message = document.getElementById("book-message");
    const currentEvents = getEvents();
    const currentEvent = currentEvents.find(function (item) { return item.id === event.id; });
    if (!currentEvent || seats < 1 || seats > 10 || currentEvent.bookedSeats + seats > currentEvent.capacity) {
      message.textContent = "Not enough tickets are available. Please refresh the page.";
      return;
    }
    currentEvent.bookedSeats += seats;
    saveData(STORAGE_KEYS.events, currentEvents);
    const booking = {
      id: createId("booking"),
      bookingCode: "VF-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      userId: signedInUser.id,
      eventId: currentEvent.id,
      seats: seats,
      totalAmount: Number(currentEvent.price) * seats,
      status: "confirmed",
      createdAt: new Date().toISOString()
    };
    const bookings = getBookings();
    bookings.unshift(booking);
    saveData(STORAGE_KEYS.bookings, bookings);
    window.location.href = "./confirmation.html?id=" + encodeURIComponent(booking.id);
  });
}

function setFormMessage(message) {
  const messageBox = document.getElementById("form-message");
  if (messageBox) messageBox.textContent = message;
}

function safeNextPage() {
  const nextPage = new URLSearchParams(window.location.search).get("next");
  if (nextPage && nextPage.startsWith("./") && !nextPage.includes("://")) return nextPage;
  return signedInUser && signedInUser.role === "admin" ? "./admin.html" : "./bookings.html";
}

function setUpLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    setFormMessage("Checking your details...");
    try {
      const values = getFormValues(form);
      const passwordHash = await hashPassword(String(values.password || ""));
      const user = getUsers().find(function (item) {
        return item.email === String(values.email).trim().toLowerCase() && item.passwordHash === passwordHash;
      });
      if (!user) {
        setFormMessage("Email or password is incorrect. Please try again.");
        button.disabled = false;
        return;
      }
      localStorage.setItem(STORAGE_KEYS.currentUser, user.id);
      signedInUser = user;
      const nextPage = safeNextPage();
      window.location.href = user.role === "admin" && nextPage === "./bookings.html" ? "./admin.html" : nextPage;
    } catch (error) {
      setFormMessage("Sign in could not be completed in this browser. Open the site through HTTPS or Live Server.");
      button.disabled = false;
    }
  });
}

function setUpRegisterForm() {
  const form = document.getElementById("register-form");
  if (!form) return;
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    const values = getFormValues(form);
    const name = String(values.name || "").trim();
    const email = String(values.email || "").trim().toLowerCase();
    const password = String(values.password || "");
    if (name.length < 2) { setFormMessage("Please enter a name with at least 2 characters."); button.disabled = false; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormMessage("Please enter a valid email address."); button.disabled = false; return; }
    if (password.length < 8) { setFormMessage("Your password must have at least 8 characters."); button.disabled = false; return; }
    const users = getUsers();
    if (users.some(function (user) { return user.email === email; })) {
      setFormMessage("This email is already registered. Please log in.");
      button.disabled = false;
      return;
    }
    try {
      const user = { id: createId("user"), name: name, email: email, passwordHash: await hashPassword(password), role: "user", createdAt: new Date().toISOString() };
      users.push(user);
      saveData(STORAGE_KEYS.users, users);
      localStorage.setItem(STORAGE_KEYS.currentUser, user.id);
      signedInUser = user;
      window.location.href = "./events.html";
    } catch (error) {
      setFormMessage("Account creation could not be completed. Open the site through HTTPS or Live Server.");
      button.disabled = false;
    }
  });
}

function loadMyBookings() {
  const bookingArea = document.getElementById("booking-list");
  if (!bookingArea) return;
  if (!signedInUser) {
    bookingArea.innerHTML = '<div class="empty-message">Please <a href="./login.html?next=./bookings.html">log in</a> to see your bookings.</div>';
    return;
  }
  const bookings = getBookings().filter(function (booking) { return booking.userId === signedInUser.id; });
  if (!bookings.length) {
    bookingArea.innerHTML = '<div class="empty-message">You have not booked an event yet. <a href="./events.html">Explore events</a>.</div>';
    return;
  }
  bookingArea.innerHTML = bookings.map(function (booking) {
    const event = getEventById(booking.eventId) || {};
    const confirmLink = "./confirmation.html?id=" + encodeURIComponent(booking.id);
    const cancelButton = booking.status === "confirmed" ? '<button class="small-button" data-cancel-booking="' + escapeText(booking.id) + '" type="button">Cancel booking</button>' : "";
    return `<div class="booking-card"><div><span class="status ${booking.status === "cancelled" ? "status-cancelled" : ""}">${escapeText(booking.status)}</span>
      <h3>${escapeText(event.title || "Event booking")}</h3><p>${escapeText(showDate(event.date))} &middot; ${escapeText(event.time || "")}</p>
      <p>${escapeText(event.venue || "")}, ${escapeText(event.city || "")}</p><p>${Number(booking.seats)} ticket(s) &middot; Total: ${escapeText(showPrice(booking.totalAmount))}</p><p>Reference: ${escapeText(booking.bookingCode)}</p></div>
      <div class="booking-actions"><a class="small-button" href="${confirmLink}">View confirmation</a>${cancelButton}</div></div>`;
  }).join("");
  document.querySelectorAll("[data-cancel-booking]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (!window.confirm("Cancel this booking? The tickets will be made available again.")) return;
      const bookingId = button.dataset.cancelBooking;
      const bookingsNow = getBookings();
      const booking = bookingsNow.find(function (item) { return item.id === bookingId && item.userId === signedInUser.id; });
      if (!booking || booking.status !== "confirmed") return;
      booking.status = "cancelled";
      const events = getEvents();
      const event = events.find(function (item) { return item.id === booking.eventId; });
      if (event) event.bookedSeats = Math.max(0, Number(event.bookedSeats || 0) - Number(booking.seats));
      saveData(STORAGE_KEYS.bookings, bookingsNow);
      saveData(STORAGE_KEYS.events, events);
      loadMyBookings();
    });
  });
}

function loadBookingConfirmation() {
  const confirmationArea = document.getElementById("confirmation-card");
  if (!confirmationArea) return;
  const bookingId = new URLSearchParams(window.location.search).get("id");
  const booking = getBookings().find(function (item) { return item.id === bookingId; });
  if (!booking || (!signedInUser || (booking.userId !== signedInUser.id && signedInUser.role !== "admin"))) {
    confirmationArea.innerHTML = '<div class="empty-message">This booking could not be found for your account. <a href="./bookings.html">Open My bookings</a>.</div>';
    return;
  }
  const event = getEventById(booking.eventId) || {};
  confirmationArea.innerHTML = `<div class="confirmation-card">
    <p class="small-heading orange-text">${booking.status === "confirmed" ? "BOOKING CONFIRMED" : "BOOKING CANCELLED"}</p>
    <span class="confirmation-code">${escapeText(booking.bookingCode)}</span><h1>It's a plan.</h1>
    <p class="section-description">Your booking has been saved in this browser. Keep this confirmation for your records.</p>
    <div class="confirmation-details"><h2>${escapeText(event.title || "Event booking")}</h2>
      <p><strong>Date:</strong> ${escapeText(showDate(event.date))}</p><p><strong>Time:</strong> ${escapeText(event.time || "")}</p>
      <p><strong>Venue:</strong> ${escapeText(event.venue || "")}, ${escapeText(event.city || "")}</p><p><strong>Tickets:</strong> ${Number(booking.seats)}</p>
      <p><strong>Total:</strong> ${escapeText(showPrice(booking.totalAmount))}</p><p><strong>Status:</strong> ${escapeText(booking.status)}</p></div>
    <div class="confirmation-buttons"><button class="button" id="print-confirmation" type="button">Print confirmation</button><a class="button button-light" href="./bookings.html">My bookings</a><a class="button button-light" href="./events.html">Explore more events</a></div>
    <p class="event-location">This is a demo booking confirmation, not a payment receipt.</p></div>`;
  document.getElementById("print-confirmation").addEventListener("click", function () { window.print(); });
}

function makeTable(headers, rows) {
  let html = "<table><thead><tr>";
  headers.forEach(function (header) { html += "<th>" + escapeText(header) + "</th>"; });
  html += "</tr></thead><tbody>";
  html += rows || '<tr><td colspan="' + headers.length + '">No records to show.</td></tr>';
  return html + "</tbody></table>";
}

function loadAdminDashboard() {
  const adminArea = document.getElementById("admin-area");
  if (!adminArea) return;
  const pageMessage = document.getElementById("admin-message");
  const statsArea = document.getElementById("admin-stats");
  const eventTable = document.getElementById("admin-event-table");
  const bookingTable = document.getElementById("admin-booking-table");
  const usersTable = document.getElementById("admin-user-table");
  const form = document.getElementById("event-form");
  let savedEvents = [];
  let savedBookings = [];

  if (!signedInUser || signedInUser.role !== "admin") {
    adminArea.hidden = true;
    pageMessage.innerHTML = 'Please <a href="./login.html?next=./admin.html">sign in with the demo organizer account</a> to manage events.';
    return;
  }

  function resetEventForm() {
    form.reset();
    form.elements.eventId.value = "";
    form.elements.city.value = "Hyderabad";
    form.elements.price.value = "0";
    form.elements.capacity.value = "50";
    document.getElementById("event-form-heading").textContent = "Add an event";
    document.getElementById("event-submit").textContent = "Save event";
  }

  function refreshDashboard() {
    savedEvents = getEvents().slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    savedBookings = getBookings().slice().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
    const users = getUsers().slice().sort(function (a, b) {
      return String(a.email || "").localeCompare(String(b.email || ""));
    });
    const attendeeUsers = users.filter(function (user) { return user.role !== "admin"; });
    const adminUsers = users.filter(function (user) { return user.role === "admin"; });
    const confirmedBookings = savedBookings.filter(function (booking) { return booking.status === "confirmed"; });
    const confirmedTickets = confirmedBookings.reduce(function (sum, booking) { return sum + Number(booking.seats || 0); }, 0);
    const bookingValue = confirmedBookings.reduce(function (sum, booking) { return sum + Number(booking.totalAmount || 0); }, 0);

    statsArea.innerHTML = `
      <div class="stat-card"><p>Events listed</p><strong>${savedEvents.length}</strong></div>
      <div class="stat-card"><p>All accounts, including admin</p><strong>${users.length}</strong></div>
      <div class="stat-card"><p>Attendee accounts</p><strong>${attendeeUsers.length}</strong></div>
      <div class="stat-card"><p>Admin accounts</p><strong>${adminUsers.length}</strong></div>
      <div class="stat-card"><p>Confirmed booking records</p><strong>${confirmedBookings.length}</strong></div>
      <div class="stat-card"><p>Confirmed tickets</p><strong>${confirmedTickets}</strong></div>
      <div class="stat-card"><p>Confirmed booking value</p><strong>${escapeText(showPrice(bookingValue))}</strong></div>`;

    const eventRows = savedEvents.map(function (event) {
      return `<tr><td><strong>${escapeText(event.title)}</strong><br>${escapeText(event.category)}</td><td>${escapeText(showDate(event.date))}</td>
        <td>${Number(event.bookedSeats || 0)} / ${Number(event.capacity)}</td><td>${escapeText(showPrice(event.price))}</td>
        <td><div class="table-buttons"><button class="small-button" data-edit-event="${escapeText(event.id)}" type="button">Edit</button><button class="small-button delete-button" data-delete-event="${escapeText(event.id)}" type="button">Delete</button></div></td></tr>`;
    }).join("");
    eventTable.innerHTML = makeTable(["Event", "Date", "Tickets booked / capacity", "Price", "Actions"], eventRows);

    const bookingRows = savedBookings.map(function (booking) {
      const user = users.find(function (item) { return item.id === booking.userId; });
      const event = getEventById(booking.eventId);
      return `<tr><td><strong>${escapeText(booking.bookingCode || booking.id)}</strong></td><td>${escapeText(user ? user.name : "Unknown")}<br>${escapeText(user ? user.email : "")}</td>
        <td>${escapeText(event ? event.title : "Deleted event")}</td><td>${Number(booking.seats || 0)}</td><td>${escapeText(showPrice(booking.totalAmount))}</td><td>${escapeText(booking.status)}</td><td>${escapeText(showDate((booking.createdAt || "").slice(0, 10)))}</td></tr>`;
    }).join("");
    bookingTable.innerHTML = makeTable(["Reference", "Attendee", "Event", "Tickets", "Total", "Status", "Booked on"], bookingRows);

    const userRows = users.map(function (user) {
      const accountBookings = savedBookings.filter(function (booking) { return booking.userId === user.id; });
      const confirmedCount = accountBookings.filter(function (booking) { return booking.status === "confirmed"; }).length;
      return `<tr><td><strong>${escapeText(user.name || "Unnamed user")}</strong></td><td>${escapeText(user.email || "")}</td>
        <td>${escapeText(user.role || "user")}</td><td>${escapeText(user.createdAt ? showDate(user.createdAt.slice(0, 10)) : "Existing account")}</td><td>${accountBookings.length}</td><td>${confirmedCount}</td></tr>`;
    }).join("");
    usersTable.innerHTML = makeTable(["Name", "Email", "Role", "Created", "Booking records", "Confirmed"], userRows);

    document.querySelectorAll("[data-edit-event]").forEach(function (button) {
      button.addEventListener("click", function () {
        const event = savedEvents.find(function (item) { return item.id === button.dataset.editEvent; });
        if (!event) return;
        ["title", "category", "date", "time", "venue", "city", "price", "capacity", "image", "description"].forEach(function (key) {
          if (form.elements[key]) form.elements[key].value = event[key] == null ? "" : event[key];
        });
        form.elements.eventId.value = event.id;
        document.getElementById("event-form-heading").textContent = "Edit event";
        document.getElementById("event-submit").textContent = "Update event";
        form.scrollIntoView({ behavior: "smooth" });
      });
    });

    document.querySelectorAll("[data-delete-event]").forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.dataset.deleteEvent;
        const event = savedEvents.find(function (item) { return item.id === id; });
        if (!event || !window.confirm("Delete '" + event.title + "'?")) return;
        if (savedBookings.some(function (booking) { return booking.eventId === id; })) {
          pageMessage.textContent = "This event has booking history, so it cannot be deleted. You can edit it instead.";
          return;
        }
        saveData(STORAGE_KEYS.events, getEvents().filter(function (item) { return item.id !== id; }));
        pageMessage.textContent = "Event deleted.";
        refreshDashboard();
      });
    });
  }

  function createDataBackup() {
    return {
      app: "VenueFlow",
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      note: "Contains user profile data and password hashes. Keep it private.",
      users: getUsers(),
      events: getEvents(),
      bookings: getBookings()
    };
  }

  function downloadJsonBackup() {
    const json = JSON.stringify(createDataBackup(), null, 2);
    const file = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "venueflow-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    pageMessage.textContent = "Backup downloaded. Keep the JSON file private; it includes account data and password hashes.";
  }

  async function mergeJsonBackup(file) {
    const text = await file.text();
    const backup = JSON.parse(text);
    const incomingUsers = Array.isArray(backup.users) ? backup.users : null;
    const incomingEvents = Array.isArray(backup.events) ? backup.events : null;
    const incomingBookings = Array.isArray(backup.bookings) ? backup.bookings : null;
    if (backup.app !== "VenueFlow" || backup.backupVersion !== 1 || !incomingUsers || !incomingEvents || !incomingBookings) {
      throw new Error("This file is not a valid VenueFlow backup.");
    }

    const users = getUsers();
    const events = getEvents();
    const bookings = getBookings();
    const userIdMap = {};
    let usersAdded = 0;
    let eventsAdded = 0;
    let bookingsAdded = 0;

    incomingUsers.forEach(function (incoming) {
      if (!incoming || !incoming.id || !incoming.email) return;
      const email = String(incoming.email).trim().toLowerCase();
      let existing = users.find(function (item) { return String(item.email || "").trim().toLowerCase() === email; });
      if (existing) {
        userIdMap[incoming.id] = existing.id;
        // Preserve account identity locally, but carry the exported hash so that the moved account can still sign in.
        existing.name = incoming.name || existing.name;
        existing.passwordHash = incoming.passwordHash || existing.passwordHash;
        existing.createdAt = existing.createdAt || incoming.createdAt;
        if (email === "admin@venueflow.demo" || incoming.role === "admin") existing.role = "admin";
      } else {
        const copy = Object.assign({}, incoming);
        if (users.some(function (item) { return item.id === copy.id; })) copy.id = createId("user");
        copy.email = email;
        copy.role = email === "admin@venueflow.demo" || copy.role === "admin" ? "admin" : "user";
        users.push(copy);
        userIdMap[incoming.id] = copy.id;
        usersAdded += 1;
      }
    });

    const eventIdMap = {};
    incomingEvents.forEach(function (incoming) {
      if (!incoming || !incoming.id || !incoming.title) return;
      let existing = events.find(function (item) { return item.id === incoming.id; });
      if (!existing) {
        const signature = [incoming.title, incoming.date, incoming.venue, incoming.city].join("|").toLowerCase();
        existing = events.find(function (item) {
          return [item.title, item.date, item.venue, item.city].join("|").toLowerCase() === signature;
        });
      }
      if (existing) {
        const mappedId = existing.id;
        Object.assign(existing, incoming, { id: mappedId });
        eventIdMap[incoming.id] = mappedId;
      } else {
        const copy = Object.assign({}, incoming);
        if (events.some(function (item) { return item.id === copy.id; })) copy.id = createId("event");
        copy.bookedSeats = 0;
        events.push(copy);
        eventIdMap[incoming.id] = copy.id;
        eventsAdded += 1;
      }
    });

    incomingBookings.forEach(function (incoming) {
      if (!incoming || !incoming.id || !incoming.userId || !incoming.eventId) return;
      const code = String(incoming.bookingCode || "");
      const exists = bookings.some(function (item) {
        return item.id === incoming.id || (code && item.bookingCode === code);
      });
      if (exists) return;
      const mappedUserId = userIdMap[incoming.userId] || incoming.userId;
      const mappedEventId = eventIdMap[incoming.eventId] || incoming.eventId;
      if (!users.some(function (item) { return item.id === mappedUserId; })) return;
      if (!events.some(function (item) { return item.id === mappedEventId; })) return;
      const copy = Object.assign({}, incoming, { userId: mappedUserId, eventId: mappedEventId });
      if (bookings.some(function (item) { return item.id === copy.id; })) copy.id = createId("booking");
      bookings.push(copy);
      bookingsAdded += 1;
    });

    saveData(STORAGE_KEYS.users, users);
    saveData(STORAGE_KEYS.events, events);
    saveData(STORAGE_KEYS.bookings, bookings);
    syncBookedSeats();
    loadCurrentUser();
    updateNavigation();
    refreshDashboard();
    pageMessage.textContent = "Backup merged successfully: " + usersAdded + " new account(s), " + eventsAdded + " new event(s), and " + bookingsAdded + " new booking record(s). Existing records were kept.";
  }

  refreshDashboard();
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const values = getFormValues(form);
    const id = values.eventId;
    const eventObject = {
      id: id || createId("event"),
      title: String(values.title || "").trim(),
      category: values.category,
      date: values.date,
      time: String(values.time || "").trim(),
      venue: String(values.venue || "").trim(),
      city: String(values.city || "").trim(),
      price: Number(values.price),
      capacity: Number(values.capacity),
      image: String(values.image || "").trim() || defaultImage,
      description: String(values.description || "").trim(),
      bookedSeats: 0
    };
    if (!eventObject.title || !eventObject.date || !eventObject.time || !eventObject.venue || !eventObject.city || !eventObject.description) {
      pageMessage.textContent = "Please complete all required event details.";
      return;
    }
    if (!Number.isFinite(eventObject.price) || eventObject.price < 0 || !Number.isInteger(eventObject.capacity) || eventObject.capacity < 1) {
      pageMessage.textContent = "Enter a valid price and a ticket capacity greater than zero.";
      return;
    }
    const allEvents = getEvents();
    const existing = allEvents.find(function (item) { return item.id === id; });
    if (existing) {
      if (eventObject.capacity < Number(existing.bookedSeats || 0)) {
        pageMessage.textContent = "Capacity cannot be lower than the number of tickets already booked.";
        return;
      }
      eventObject.bookedSeats = Number(existing.bookedSeats || 0);
      allEvents[allEvents.findIndex(function (item) { return item.id === id; })] = eventObject;
      pageMessage.textContent = "Event updated.";
    } else {
      allEvents.push(eventObject);
      pageMessage.textContent = "Event added.";
    }
    saveData(STORAGE_KEYS.events, allEvents);
    resetEventForm();
    refreshDashboard();
  });

  document.getElementById("event-reset").addEventListener("click", function () {
    resetEventForm();
    pageMessage.textContent = "";
  });

  document.getElementById("download-report").addEventListener("click", function () {
    const rows = [["Booking reference", "Attendee", "Email", "Event", "Event date", "Tickets", "Total", "Status", "Created at"]];
    savedBookings.forEach(function (booking) {
      const user = getUsers().find(function (item) { return item.id === booking.userId; });
      const event = getEventById(booking.eventId);
      rows.push([booking.bookingCode || booking.id, user ? user.name : "Unknown", user ? user.email : "", event ? event.title : "Deleted event", event ? showDate(event.date) : "", booking.seats, booking.totalAmount, booking.status, booking.createdAt || ""]);
    });
    const csvText = rows.map(function (row) {
      return row.map(function (value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    const file = new Blob(["\ufeff" + csvText], { type: "text/csv;charset=utf-8;" });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = "venueflow-booking-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(fileUrl); }, 1000);
  });

  const backupButton = document.getElementById("download-backup");
  const importButton = document.getElementById("import-backup-button");
  const importInput = document.getElementById("import-backup-file");
  if (backupButton) backupButton.addEventListener("click", downloadJsonBackup);
  if (importButton && importInput) importButton.addEventListener("click", function () { importInput.click(); });
  if (importInput) importInput.addEventListener("change", async function () {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    if (!window.confirm("Merge this backup with the current browser data? Existing records will be kept. The import includes accounts and password hashes.")) {
      importInput.value = "";
      return;
    }
    try {
      await mergeJsonBackup(file);
    } catch (error) {
      pageMessage.textContent = "Import failed: " + (error && error.message ? error.message : "The file could not be read.");
    }
    importInput.value = "";
  });

  // Keep the admin view refreshed if another tab on this same website changes localStorage.
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEYS.currentUser) {
      window.location.reload();
      return;
    }
    if ([STORAGE_KEYS.users, STORAGE_KEYS.events, STORAGE_KEYS.bookings].includes(event.key) || event.key === null) {
      loadCurrentUser();
      updateNavigation();
      refreshDashboard();
    }
  });
}

async function startWebsite() {
  await initializeStorage();
  loadCurrentUser();
  updateNavigation();
  loadHomeEvents();
  loadAllEvents();
  loadEventDetails();
  setUpLoginForm();
  setUpRegisterForm();
  loadMyBookings();
  loadBookingConfirmation();
  loadAdminDashboard();
}

startWebsite().catch(function () {
  const areas = ["featured-events", "all-events", "event-detail", "booking-list", "confirmation-card", "admin-message"];
  areas.forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = '<p class="empty-message">The site could not start. Please use HTTPS or open it through VS Code Live Server.</p>';
  });
});
