# VenueFlow — no-database student demo

VenueFlow is a multi-page event booking website made with plain HTML, CSS and JavaScript. It does not require Node.js, npm, Express, MongoDB, Atlas, or a `.env` file.

## What works in this demo

- Browse upcoming events, search by word, and filter by category.
- Register an account and sign in or out.
- Book tickets, reduce available seats, and show a confirmation reference.
- View and cancel your bookings.
- Sign in as the demo organizer to add, edit and delete events, view every account and booking stored in this browser, download CSV reports, and export/import a full JSON backup.
- The admin dashboard separately reports booking records and ticket quantities, so one booking for 24 tickets is not confused with 24 separate bookings.
- Save changes in the browser with `localStorage`.

## Important limitation

This version stores data in the current browser, not on a server. Accounts, events, and bookings on one device/browser are **not shared** with other visitors, browsers, or devices. Logging out does not delete records. The admin page has a full JSON backup/import tool for moving data between website URLs or browser profiles. Clearing browser site data removes the saved records. Browser-only login is for a student demonstration, not security: do not use real passwords or real customer information. A real multi-user booking service needs a backend and shared database or another persistent server-side store.

Banner images are set with a public image URL. Uploading files is not included because there is no server to store uploaded files.

## Run locally in VS Code

1. Extract the ZIP.
2. Open the extracted `venueflow-no-database-fixed` folder in VS Code.
3. Install/use the **Live Server** extension if you do not already have it.
4. Right-click `index.html` and select **Open with Live Server**.
5. Browse around the site. You do not need to run `npm install`, create `.env`, or start MongoDB.

Use Live Server instead of opening the file directly, so browser storage and browser security features behave consistently.

## Demo organizer account

- Email: `admin@venueflow.demo`
- Password: `VenueFlow2026!`

This public demo account is intentionally for demonstration only. Anyone who knows these details can enter the organizer area in their own browser. Do not reuse this password anywhere else.

## Test the main features

1. Open **Sign up** and create a regular test account with a throwaway email and a password of at least 8 characters.
2. Open **Explore events**, select an event and book 1–2 tickets.
3. Open **My bookings**, view the confirmation, and try cancelling the booking.
4. Log out and sign in with the demo organizer account above.
5. Open **Admin**, check the registered accounts table and booking list, edit/add an event, download the CSV, and try downloading a full JSON backup.
6. If you move the site to another Vercel hostname or browser profile, export a JSON backup from the old admin page first and import/merge it on the new site.
7. Test search and category filtering on the events page.

All test information remains in the same browser. Logging in with the demo organizer account in another browser will show a separate copy of the seeded events and no bookings from the first browser.

## Deploy on Vercel from its website

This is a static site; it has no build step or backend function.

1. Extract the ZIP on your computer.
2. Create a GitHub repository, for example `venueflow-no-database`.
3. Upload the **contents** of this folder to the repository root. Confirm `index.html`, `events.html`, `css`, `js`, and `images` are at the root of the repository. Do not upload an old `.env` file.
4. Open [Vercel](https://vercel.com/), choose **Add New → Project**, connect GitHub, and import this repository.
5. If asked for a framework, select **Other**. Leave Build Command and Install Command empty. Set Output Directory to `.` if Vercel requests one.
6. Click **Deploy**.
7. Open the generated URL over HTTPS and test registration, login, event booking, cancellation, admin edits, CSV and JSON backup.

### Update your existing VenueFlow deployment without changing its saved browser data

- Replace the files in the **same GitHub repository and Vercel project** that currently serve `https://venueflow-nu.vercel.app`.
- Commit the changes and let the same Vercel project redeploy.
- Test using the exact same URL and browser profile.
- Do not create a separate Vercel project with a new `*.vercel.app` hostname if you need the current browser's saved records. Browser storage is isolated by website origin, so the new hostname will look like a new empty site.
- If records are split across different hostnames or browser profiles, sign in as admin on each source, download its full JSON backup, then import/merge those backup files on the destination site. A backup contains account data and password hashes; keep it private.

Do not configure MongoDB or environment variables for this version; it does not use either.

## Files

- `index.html` — home page
- `events.html` — event listing and filters
- `event.html` — details and ticket booking
- `register.html` — sign up
- `login.html` — sign in
- `bookings.html` — booking history and cancellation
- `confirmation.html` — printable booking confirmation
- `admin.html` — event management, statistics and CSV report
- `css/style.css` — all styling
- `js/app.js` — page logic and browser storage
- `images/hero-concert.jpg` — local hero image
