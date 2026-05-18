import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const app = initializeApp({
    apiKey: "AIzaSyB2FQGM7RGVjFQ7fxddIiAN5O7A0bF_omM", 
    authDomain: "reader2-43b34.firebaseapp.com",
    projectId: "reader2-43b34", 
    storageBucket: "reader2-43b34.firebasestorage.app", 
    appId: "1:909397198375:web:bd21eb8f3731b545af7002"
});

export const db = getFirestore(app);
export const auth = getAuth(app);