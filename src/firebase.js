import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDcFW5zAnvolkGDAsLVWQvN-P6iYr_8WmM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "riderpro-11d83.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "riderpro-11d83",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "riderpro-11d83.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "8430695370",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:8430695370:web:30b64845cb3e9ea23f9533",
};

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
let app = null;
let auth = null;
let db = null;

if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export { app, auth, db, googleProvider, signInWithRedirect, signInWithPopup, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
export const isFirebaseConfigured = Boolean(auth && db);
export const firebaseConfigReady = configured;
