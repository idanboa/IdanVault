import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZliGVgOrb9vxm3nOOQkrTiAhrbEfg8Rw",
  authDomain: "idanvaultproduction.firebaseapp.com",
  projectId: "idanvaultproduction",
  storageBucket: "idanvaultproduction.firebasestorage.app",
  messagingSenderId: "455680475122",
  appId: "1:455680475122:web:15b8049a452c6a76fcf56b"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Enable auth persistence (stays logged in across page reloads)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error);
});
