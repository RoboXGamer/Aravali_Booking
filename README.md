# Aravalli Auditorium

A movie polling and ticket-booking platform for Aravalli Auditorium. Visitors can vote for the weekly movie, select seats, pay online, and receive a QR ticket; admins can manage shows, bookings, polls, and check-ins.

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
