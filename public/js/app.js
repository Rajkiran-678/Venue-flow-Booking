// This file is loaded at the end of each HTML page.
// Keep the same small functions so they are easy to find and change.

let signedInUser = null;

const defaultImage = "./images/hero-concert.jpg";

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
  const date = new Date(dateValue);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function showDateTime(dateValue) {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getFormValues(form) {
  const values = {};
  const formData = new FormData(form);
  formData.forEach(function (value, name) {
    values[name] = value;
  });
  return values;
}

async function callApi(url, options) {
  const settings = options || {};
  settings.credentials = "same-origin";
  settings.headers = settings.headers || {};

  if (settings.body && typeof settings.body !== "string") {
    settings.headers["Content-Type"] = "application/json";
    settings.body = JSON.stringify(settings.body);
  }

  let response;
  try {
    response = await fetch(url, settings);
  } catch (error) {
    throw new Error("Cannot reach the VenueFlow server. Check your internet connection and Vercel deployment.");
  }

  const contentType = response.headers.get("content-type") || "";
  let result = {};
  if (contentType.includes("application/json")) {
    result = await response.json().catch(function () { return {}; });
  }

  if (!response.ok) {
    if (result.message) throw new Error(result.message);
    if (response.status === 404 || response.status === 405) {
      throw new Error("The API route is not running in this deployment. Deploy the full Express project, not the static-only ZIP.");
    }
    throw new Error("Server error (HTTP " + response.status + "). Check Vercel Runtime Logs.");
  }

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned a page instead of API data. Check the Vercel Express deployment configuration.");
  }
  return result;
}

function makeEventCard(event) {
  const image = event.image || defaultImage;
  const eventLink = "./event.html?id=" + encodeURIComponent(event._id);
  const availableSeats = Number(event.availableSeats == null ? event.capacity - event.bookedSeats : event.availableSeats);

  return `
    <div class="event-card">
      <a href="${eventLink}">
        <img class="event-image" src="${escapeText(image)}" alt="Photo for ${escapeText(event.title)}">
      </a>
      <div class="event-info">
        <span class="event-category">${escapeText(event.category)}</span>
        <h3><a href="${eventLink}">${escapeText(event.title)}</a></h3>
        <p class="event-date">${escapeText(showDate(event.date))} &middot; ${escapeText(event.time)}</p>
        <p class="event-location">${escapeText(event.venue)}, ${escapeText(event.city)}</p>
        <div class="event-bottom">
          <span class="event-price">${escapeText(showPrice(event.price))}</span>
          <a href="${eventLink}">View event &rarr;</a>
        </div>
        <p class="event-location">${availableSeats} tickets left</p>
      </div>
    </div>`;
}

async function updateNavigation() {
  const accountLinks = document.getElementById("account-links");
  const adminLink = document.getElementById("admin-link");
  if (!accountLinks) return;

  try {
    const result = await callApi("./api/auth/me");
    signedInUser = result.user;

    if (signedInUser) {
      accountLinks.innerHTML = `
        <span class="welcome-text">Hi, ${escapeText(signedInUser.name)}</span>
        <button class="small-button" id="logout-button" type="button">Log out</button>`;
      document.getElementById("logout-button").addEventListener("click", async function () {
        try {
          await callApi("./api/auth/logout", { method: "POST", body: "{}" });
          window.location.href = "./index.html";
        } catch (error) {
          alert(error.message);
        }
      });
      if (adminLink) adminLink.style.display = signedInUser.role === "admin" ? "inline" : "none";
    } else {
      accountLinks.innerHTML = '<a href="./login.html">Log in</a><a class="button button-small" href="./register.html">Sign up</a>';
      if (adminLink) adminLink.style.display = "none";
    }
  } catch (error) {
    if (adminLink) adminLink.style.display = "none";
  }
}

async function loadHomeEvents() {
  const eventArea = document.getElementById("featured-events");
  if (!eventArea) return;

  try {
    const result = await callApi("./api/events");
    if (result.events.length === 0) {
      eventArea.innerHTML = '<p class="empty-message">No upcoming events yet. Please check back soon.</p>';
      return;
    }
    eventArea.innerHTML = result.events.slice(0, 3).map(makeEventCard).join("");
  } catch (error) {
    eventArea.innerHTML = '<p class="empty-message">' + escapeText(error.message) + '</p>';
  }
}

async function loadAllEvents() {
  const eventArea = document.getElementById("all-events");
  if (!eventArea) return;

  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const query = new URLSearchParams(window.location.search);
  if (searchInput) searchInput.value = query.get("search") || "";
  if (categoryFilter) categoryFilter.value = query.get("category") || "All events";

  async function searchEvents(event) {
    if (event) event.preventDefault();

    const searchText = searchInput ? searchInput.value.trim() : "";
    const category = categoryFilter ? categoryFilter.value : "All events";
    const queryParts = [];
    if (searchText) queryParts.push("search=" + encodeURIComponent(searchText));
    if (category && category !== "All events") queryParts.push("category=" + encodeURIComponent(category));

    const queryString = queryParts.length ? "?" + queryParts.join("&") : "";
    window.history.replaceState({}, "", "./events.html" + queryString);

    try {
      eventArea.innerHTML = "<p>Searching events...</p>";
      const result = await callApi("./api/events" + (queryString ? queryString : ""));
      const count = document.getElementById("event-count");
      if (count) count.textContent = result.events.length + " event(s) found";

      if (result.events.length === 0) {
        eventArea.innerHTML = '<p class="empty-message">No events matched that search. Try another word or category.</p>';
      } else {
        eventArea.innerHTML = result.events.map(makeEventCard).join("");
      }
    } catch (error) {
      eventArea.innerHTML = '<p class="empty-message">' + escapeText(error.message) + '</p>';
    }
  }

  const searchForm = document.getElementById("event-search");
  if (searchForm) searchForm.addEventListener("submit", searchEvents);
  await searchEvents();
}

async function loadEventDetails() {
  const detailArea = document.getElementById("event-detail");
  if (!detailArea) return;

  const eventId = new URLSearchParams(window.location.search).get("id");
  if (!eventId) {
    detailArea.innerHTML = '<p class="empty-message">No event was selected. <a href="./events.html">Choose an event</a>.</p>';
    return;
  }

  try {
    const result = await callApi("./api/events/" + encodeURIComponent(eventId));
    const event = result.event;
    const availableSeats = Number(event.availableSeats);
    const loginNext = "./event.html?id=" + encodeURIComponent(event._id);

    detailArea.innerHTML = `
      <div class="event-detail">
        <div>
          <img class="detail-image" src="${escapeText(event.image || defaultImage)}" alt="Photo for ${escapeText(event.title)}">
          <div class="detail-box">
            <p><strong>About this event</strong></p>
            <p>${escapeText(event.description)}</p>
          </div>
        </div>
        <div class="detail-copy">
          <span class="event-category">${escapeText(event.category)}</span>
          <h1>${escapeText(event.title)}</h1>
          <p class="detail-description">Make time for something new and meet people who share your interests.</p>
          <div class="detail-box">
            <p><strong>Date:</strong> ${escapeText(showDate(event.date))}</p>
            <p><strong>Time:</strong> ${escapeText(event.time)}</p>
            <p><strong>Venue:</strong> ${escapeText(event.venue)}, ${escapeText(event.city)}</p>
            <p><strong>Tickets left:</strong> ${availableSeats}</p>
            <p class="detail-price">${escapeText(showPrice(event.price))} <span>per ticket</span></p>
            <form id="book-form">
              <input type="hidden" name="eventId" value="${escapeText(event._id)}">
              <label>Number of tickets
                <select name="seats" id="ticket-count">
                  ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(function (number) { return number <= availableSeats; }).map(function (number) { return '<option value="' + number + '">' + number + '</option>'; }).join("")}
                </select>
              </label>
              <button class="button" type="submit" ${availableSeats < 1 ? "disabled" : ""}>Book tickets</button>
              <p class="form-message" id="book-message"></p>
            </form>
            ${signedInUser ? "" : '<p class="event-location">You will need to <a href="./login.html?next=' + encodeURIComponent(loginNext) + '">log in</a> before booking.</p>'}
          </div>
        </div>
      </div>`;

    const bookingForm = document.getElementById("book-form");
    bookingForm.addEventListener("submit", async function (formEvent) {
      formEvent.preventDefault();
      if (!signedInUser) {
        window.location.href = "./login.html?next=" + encodeURIComponent(loginNext);
        return;
      }

      const message = document.getElementById("book-message");
      const button = bookingForm.querySelector("button[type='submit']");
      button.disabled = true;
      message.textContent = "Saving your booking...";

      try {
        const values = getFormValues(bookingForm);
        const bookingResult = await callApi("./api/bookings", { method: "POST", body: values });
        window.location.href = "./confirmation.html?id=" + encodeURIComponent(bookingResult.booking._id);
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    });
  } catch (error) {
    detailArea.innerHTML = '<p class="empty-message">' + escapeText(error.message) + ' <a href="./events.html">Back to events</a>.</p>';
  }
}

function setFormMessage(message) {
  const messageBox = document.getElementById("form-message");
  if (messageBox) messageBox.textContent = message;
}

function safeNextPage() {
  const nextPage = new URLSearchParams(window.location.search).get("next");
  if (nextPage && nextPage.startsWith("./") && !nextPage.includes("://")) return nextPage;
  return "./bookings.html";
}

async function setUpLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setFormMessage("Checking your details...");
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;

    try {
      const result = await callApi("./api/auth/login", { method: "POST", body: getFormValues(form) });
      signedInUser = result.user;
      const nextPage = safeNextPage();
      if (signedInUser.role === "admin" && nextPage === "./bookings.html") {
        window.location.href = "./admin.html";
      } else {
        window.location.href = nextPage;
      }
    } catch (error) {
      setFormMessage(error.message);
      button.disabled = false;
    }
  });
}

async function setUpRegisterForm() {
  const form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setFormMessage("Creating your account...");
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;

    try {
      const result = await callApi("./api/auth/register", { method: "POST", body: getFormValues(form) });
      signedInUser = result.user;
      window.location.href = signedInUser.role === "admin" ? "./admin.html" : "./events.html";
    } catch (error) {
      setFormMessage(error.message);
      button.disabled = false;
    }
  });
}

async function loadMyBookings() {
  const bookingArea = document.getElementById("booking-list");
  if (!bookingArea) return;

  try {
    const result = await callApi("./api/bookings/mine");
    if (result.bookings.length === 0) {
      bookingArea.innerHTML = '<div class="empty-message">You have not booked an event yet. <a href="./events.html">Explore events</a>.</div>';
      return;
    }

    bookingArea.innerHTML = result.bookings.map(function (booking) {
      const event = booking.event || {};
      const confirmLink = "./confirmation.html?id=" + encodeURIComponent(booking._id);
      const cancelButton = booking.status === "confirmed"
        ? '<button class="small-button" data-cancel-booking="' + escapeText(booking._id) + '" type="button">Cancel booking</button>'
        : "";
      return `
        <div class="booking-card">
          <div>
            <span class="status ${booking.status === "cancelled" ? "status-cancelled" : ""}">${escapeText(booking.status)}</span>
            <h3>${escapeText(event.title || "Event booking")}</h3>
            <p>${escapeText(showDate(event.date))} &middot; ${escapeText(event.time || "")}</p>
            <p>${escapeText(event.venue || "")}, ${escapeText(event.city || "")}</p>
            <p>${Number(booking.seats)} ticket(s) &middot; Total: ${escapeText(showPrice(booking.totalAmount))}</p>
            <p>Reference: ${escapeText(booking.bookingCode)}</p>
          </div>
          <div class="booking-actions">
            <a class="small-button" href="${confirmLink}">View confirmation</a>
            ${cancelButton}
          </div>
        </div>`;
    }).join("");

    document.querySelectorAll("[data-cancel-booking]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const shouldCancel = window.confirm("Cancel this booking? The tickets will be made available again.");
        if (!shouldCancel) return;
        button.disabled = true;
        try {
          await callApi("./api/bookings/" + encodeURIComponent(button.dataset.cancelBooking) + "/cancel", { method: "POST", body: "{}" });
          await loadMyBookings();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    bookingArea.innerHTML = '<div class="empty-message">' + escapeText(error.message) + ' <a href="./login.html">Log in</a> to see your bookings.</div>';
  }
}

async function loadBookingConfirmation() {
  const confirmationArea = document.getElementById("confirmation-card");
  if (!confirmationArea) return;

  const bookingId = new URLSearchParams(window.location.search).get("id");
  if (!bookingId) {
    confirmationArea.innerHTML = '<div class="empty-message">No booking was selected. <a href="./bookings.html">Open My bookings</a>.</div>';
    return;
  }

  try {
    const result = await callApi("./api/bookings/" + encodeURIComponent(bookingId));
    const booking = result.booking;
    const event = booking.event || {};
    confirmationArea.innerHTML = `
      <div class="confirmation-card">
        <p class="small-heading orange-text">${booking.status === "confirmed" ? "BOOKING CONFIRMED" : "BOOKING CANCELLED"}</p>
        <span class="confirmation-code">${escapeText(booking.bookingCode)}</span>
        <h1>It's a plan.</h1>
        <p class="section-description">Your booking has been saved. Keep this confirmation for your records.</p>
        <div class="confirmation-details">
          <h2>${escapeText(event.title || "Event booking")}</h2>
          <p><strong>Date:</strong> ${escapeText(showDate(event.date))}</p>
          <p><strong>Time:</strong> ${escapeText(event.time || "")}</p>
          <p><strong>Venue:</strong> ${escapeText(event.venue || "")}, ${escapeText(event.city || "")}</p>
          <p><strong>Tickets:</strong> ${Number(booking.seats)}</p>
          <p><strong>Total:</strong> ${escapeText(showPrice(booking.totalAmount))}</p>
          <p><strong>Status:</strong> ${escapeText(booking.status)}</p>
        </div>
        <div class="confirmation-buttons">
          <button class="button" id="print-confirmation" type="button">Print confirmation</button>
          <a class="button button-light" href="./bookings.html">My bookings</a>
          <a class="button button-light" href="./events.html">Explore more events</a>
        </div>
        <p class="event-location">This is a booking confirmation, not a payment receipt.</p>
      </div>`;
    document.getElementById("print-confirmation").addEventListener("click", function () {
      window.print();
    });
  } catch (error) {
    confirmationArea.innerHTML = '<div class="empty-message">' + escapeText(error.message) + ' <a href="./bookings.html">Open My bookings</a>.</div>';
  }
}

function makeTable(headers, rows) {
  let html = "<table><thead><tr>";
  headers.forEach(function (header) {
    html += "<th>" + escapeText(header) + "</th>";
  });
  html += "</tr></thead><tbody>";
  html += rows || '<tr><td colspan="' + headers.length + '">No records to show.</td></tr>';
  html += "</tbody></table>";
  return html;
}

async function loadAdminDashboard() {
  const adminArea = document.getElementById("admin-area");
  if (!adminArea) return;

  const pageMessage = document.getElementById("admin-message");
  const statsArea = document.getElementById("admin-stats");
  const eventTable = document.getElementById("admin-event-table");
  const bookingTable = document.getElementById("admin-booking-table");
  const userTable = document.getElementById("admin-user-table");
  const form = document.getElementById("event-form");
  let savedEvents = [];
  let savedBookings = [];
  let savedUsers = [];

  function resetEventForm() {
    form.reset();
    form.elements.eventId.value = "";
    form.elements.city.value = "Hyderabad";
    form.elements.price.value = "0";
    form.elements.capacity.value = "50";
    document.getElementById("event-form-heading").textContent = "Add an event";
    document.getElementById("event-submit").textContent = "Save event";
  }

  async function refreshDashboard() {
    const results = await Promise.all([
      callApi("./api/admin/summary"),
      callApi("./api/admin/events"),
      callApi("./api/admin/bookings"),
      callApi("./api/admin/users")
    ]);
    const summaryResult = results[0];
    const eventResult = results[1];
    const bookingResult = results[2];
    const userResult = results[3];
    savedEvents = eventResult.events;
    savedBookings = bookingResult.bookings;
    savedUsers = userResult.users;
    const summary = summaryResult.summary;

    statsArea.innerHTML = `
      <div class="stat-card"><p>Events listed</p><strong>${summary.events}</strong></div>
      <div class="stat-card"><p>Registered attendees</p><strong>${summary.users}</strong></div>
      <div class="stat-card"><p>Administrators</p><strong>${summary.admins}</strong></div>
      <div class="stat-card"><p>Confirmed bookings</p><strong>${summary.confirmedBookings}</strong></div>
      <div class="stat-card"><p>Tickets booked</p><strong>${summary.confirmedTickets}</strong></div>
      <div class="stat-card"><p>Booking value</p><strong>${escapeText(showPrice(summary.bookingValue))}</strong></div>`;

    const userRows = savedUsers.map(function (user) {
      const userBookingCount = savedBookings.filter(function (booking) {
        const bookingUserId = booking.user && (booking.user._id || booking.user.id);
        return String(bookingUserId || "") === String(user._id);
      }).length;
      return `<tr>
        <td><strong>${escapeText(user.name)}</strong></td>
        <td>${escapeText(user.email)}</td>
        <td>${escapeText(user.role)}</td>
        <td>${escapeText(showDateTime(user.createdAt))}</td>
        <td>${userBookingCount}</td>
      </tr>`;
    }).join("");
    userTable.innerHTML = makeTable(["Name", "Email", "Role", "Registered", "Bookings"], userRows);

    const eventRows = savedEvents.map(function (event) {
      return `<tr>
        <td><strong>${escapeText(event.title)}</strong><br>${escapeText(event.category)}</td>
        <td>${escapeText(showDate(event.date))}</td>
        <td>${Number(event.bookedSeats)} / ${Number(event.capacity)}</td>
        <td>${escapeText(showPrice(event.price))}</td>
        <td><div class="table-buttons"><button class="small-button" data-edit-event="${escapeText(event._id)}" type="button">Edit</button><button class="small-button delete-button" data-delete-event="${escapeText(event._id)}" type="button">Delete</button></div></td>
      </tr>`;
    }).join("");
    eventTable.innerHTML = makeTable(["Event", "Date", "Tickets booked", "Price", "Actions"], eventRows);

    const bookingRows = savedBookings.map(function (booking) {
      return `<tr>
        <td><strong>${escapeText(booking.bookingCode)}</strong></td>
        <td>${escapeText(booking.user ? booking.user.name : "Unknown")}<br>${escapeText(booking.user ? booking.user.email : "")}</td>
        <td>${escapeText(booking.event ? booking.event.title : "Deleted event")}</td>
        <td>${Number(booking.seats)}</td>
        <td>${escapeText(showPrice(booking.totalAmount))}</td>
        <td>${escapeText(booking.status)}</td>
      </tr>`;
    }).join("");
    bookingTable.innerHTML = makeTable(["Reference", "Attendee", "Event", "Tickets", "Total", "Status"], bookingRows);

    document.querySelectorAll("[data-edit-event]").forEach(function (button) {
      button.addEventListener("click", function () {
        const event = savedEvents.find(function (item) { return item._id === button.dataset.editEvent; });
        if (!event) return;
        Object.keys(event).forEach(function (key) {
          if (form.elements[key]) {
            if (key === "date") {
              form.elements[key].value = new Date(event.date).toISOString().slice(0, 10);
            } else {
              form.elements[key].value = event[key] == null ? "" : event[key];
            }
          }
        });
        form.elements.eventId.value = event._id;
        document.getElementById("event-form-heading").textContent = "Edit event";
        document.getElementById("event-submit").textContent = "Update event";
        form.scrollIntoView({ behavior: "smooth" });
      });
    });

    document.querySelectorAll("[data-delete-event]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const event = savedEvents.find(function (item) { return item._id === button.dataset.deleteEvent; });
        if (!event || !window.confirm("Delete '" + event.title + "'?")) return;
        button.disabled = true;
        try {
          const message = await callApi("./api/admin/events/" + encodeURIComponent(event._id), { method: "DELETE" });
          pageMessage.textContent = message.message;
          await refreshDashboard();
        } catch (error) {
          pageMessage.textContent = error.message;
          button.disabled = false;
        }
      });
    });
  }

  try {
    await refreshDashboard();
  } catch (error) {
    adminArea.hidden = true;
    pageMessage.textContent = error.message + " Sign in with the configured admin account.";
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    pageMessage.textContent = "Saving event...";
    const button = document.getElementById("event-submit");
    button.disabled = true;
    const values = getFormValues(form);
    const eventId = values.eventId;
    delete values.eventId;
    values.price = Number(values.price);
    values.capacity = Number(values.capacity);

    try {
      const url = eventId ? "./api/admin/events/" + encodeURIComponent(eventId) : "./api/admin/events";
      const method = eventId ? "PUT" : "POST";
      const result = await callApi(url, { method: method, body: values });
      pageMessage.textContent = result.message;
      resetEventForm();
      await refreshDashboard();
    } catch (error) {
      pageMessage.textContent = error.message;
    }
    button.disabled = false;
  });

  document.getElementById("event-reset").addEventListener("click", function () {
    resetEventForm();
    pageMessage.textContent = "";
  });

  document.getElementById("download-report").addEventListener("click", function () {
    const rows = [["Booking reference", "Attendee", "Email", "Event", "Event date", "Tickets", "Total", "Status"]];
    savedBookings.forEach(function (booking) {
      rows.push([
        booking.bookingCode,
        booking.user ? booking.user.name : "Unknown",
        booking.user ? booking.user.email : "",
        booking.event ? booking.event.title : "Deleted event",
        booking.event ? showDate(booking.event.date) : "",
        booking.seats,
        booking.totalAmount,
        booking.status
      ]);
    });

    const csvText = rows.map(function (row) {
      return row.map(function (value) {
        return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n");

    const file = new Blob(["\ufeff" + csvText], { type: "text/csv;charset=utf-8;" });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = "venueflow-booking-report.csv";
    link.click();
    URL.revokeObjectURL(fileUrl);
  });
}

// Read the login status first, then start the parts needed on this page.
async function startWebsite() {
  await updateNavigation();
  loadHomeEvents();
  loadAllEvents();
  loadEventDetails();
  setUpLoginForm();
  setUpRegisterForm();
  loadMyBookings();
  loadBookingConfirmation();
  loadAdminDashboard();
}

startWebsite();
