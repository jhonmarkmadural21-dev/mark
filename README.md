# RiderPro — Netlify frontend + Render backend

This repository contains two separate deployable services:

- **Frontend:** React + Vite at the repository root; deploy to Netlify.
- **Backend:** Express API in `backend/`; deploy as a Render Web Service.
- **Images:** Built-in product pictures are bundled SVG files in `public/images/products/`, so they load locally without third-party image redirects.
- **Authentication/data:** Firebase configuration and Firestore rules are in `src/firebase.js` and `firestore.rules`.

## Run locally

Frontend (from the repository root):
```bash
npm install
npm run dev
```

Backend (in a second terminal):
```bash
cd backend
npm install
npm run dev
```

The frontend defaults to `http://localhost:5000` for API calls. For deployment, set `VITE_API_URL` in Netlify to your Render service URL. Because Vite variables are embedded at build time, trigger a new deploy after changing it.

## Deploy backend to Render

Create a **Web Service** from this repository:
- **Root Directory:** `backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

In Render environment variables, set `FRONTEND_URL` to your Netlify site origin, e.g. `https://your-site.netlify.app`. Set it to the exact deployed site URL; for a Netlify custom domain, include that origin too (comma-separated if needed). Render provides `PORT` automatically.

Health check: `https://YOUR-RENDER-SERVICE.onrender.com/api/health`

## Deploy frontend to Netlify

Import the same repository:
- **Base directory:** leave blank (repository root)
- **Build command:** `npm run build`
- **Publish directory:** `dist`

Set `VITE_API_URL` to `https://YOUR-RENDER-SERVICE.onrender.com` in Netlify → Site configuration → Environment variables. Do not add `/api` to the end. Then trigger a fresh deploy.

If using Firebase Authentication, add your Netlify domain to Firebase Console → Authentication → Settings → Authorized domains. Confirm the Firebase project configuration and Firestore rules before launch.

## Important notes

- The API currently demonstrates in-memory/logging CRUD routes; it does not persist product/order/user CRUD records in a database. Do not treat those demo endpoints as production data storage.
- Do not put private server secrets in `VITE_*` variables. Those are public in the frontend build.
- Never commit real `.env` files, credentials, or service-account keys.
