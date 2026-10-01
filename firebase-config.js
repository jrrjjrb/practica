import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0cS3MHGEmGiuCvv63gS-ALkZAfkWXZnQ",
  authDomain: "dadad-1ef4b.firebaseapp.com",
  projectId: "dadad-1ef4b",
  storageBucket: "dadad-1ef4b.firebasestorage.app",
  messagingSenderId: "565081537081",
  appId: "1:565081537081:web:0b8258aa5c8546e96debe8",
  measurementId: "G-4EVRJGF2QX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);