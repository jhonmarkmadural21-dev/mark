import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export const firestoreEnabled = () => Boolean(isFirebaseConfigured && db);

const requireDb = () => {
  if (!db) throw new Error("Firestore is not configured. Add VITE_FIREBASE_* values to .env.local.");
  return db;
};

export async function getCollection(name) {
  const snap = await getDocs(collection(requireDb(), name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDocument(name, id) {
  const snap = await getDoc(doc(requireDb(), name, String(id)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function upsertDocument(name, id, data) {
  await setDoc(doc(requireDb(), name, String(id)), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return { id: String(id), ...data };
}

export async function addDocument(name, data) {
  const ref = await addDoc(collection(requireDb(), name), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateDocument(name, id, data) {
  await updateDoc(doc(requireDb(), name, String(id)), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDocument(name, id) {
  await deleteDoc(doc(requireDb(), name, String(id)));
}
