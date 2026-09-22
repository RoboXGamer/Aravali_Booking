# Aravalli Auditorium

A movie polling and ticket-booking platform for Aravalli Auditorium. Visitors can vote for the weekly movie, select seats, pay online, and receive a QR ticket; admins can manage shows, bookings, polls, and check-ins.

Movies store their language and Indian film certificate (`U`, `U/A`, or `A`). Customers must confirm that they are at least 18 before booking an `A`-certified film.

## Administrator Roles

- **Operations Admin:** movie and poll management, manual ticket booking, QR check-in, and seat-layout operations.
- **Super Admin:** all Operations Admin capabilities plus show scheduling, booking management, revenue reporting, application settings, and administrator access.

Existing administrator records default to Super Admin access. After deploying the schema update, run the one-time `migrationMovieMetadataAndAdminRoles:applyMovieMetadataAndAdminRoles` migration to persist role and movie-metadata defaults on existing records.

## Tech Stack

React, TypeScript, Vite, Convex, Tailwind CSS, and Razorpay.

## Local Setup

```bash
cd frontend
pnpm install
pnpm convex:dev
pnpm dev
```

Create `frontend/.env.local` with the required deployment values:

```env
VITE_CONVEX_URL=
VITE_CONVEX_SITE_URL=
VITE_RAZORPAY_KEY_ID=
```

Run `pnpm build` to create a production build.
