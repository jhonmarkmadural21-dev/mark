# RiderPro Firebase setup

1. Firebase Console → Authentication → Sign-in method → Google → Enable.
2. Authentication → Settings → Authorized domains → make sure `localhost` is listed.
3. Firestore Database → Create database if it has not been created yet.
4. Firestore Database → Rules → paste the included `firestore.rules` and Publish.
5. If you use a different Firebase Web App, copy `.env.example` to `.env.local` and fill the values from Project settings → Your apps → Web app.
6. Run:
   npm install
   npm run dev

The Google button first tries a popup. If Chrome blocks the popup, RiderPro automatically switches to Google redirect sign-in.
