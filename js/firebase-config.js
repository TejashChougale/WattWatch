import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCYwetnNS7fSBmIV6DzxFc_Aya_IZLQdYo",
    authDomain: "wattwatch-app.firebaseapp.com",
    projectId: "wattwatch-app",
    storageBucket: "wattwatch-app.firebasestorage.app",
    messagingSenderId: "700083194715",
    appId: "1:700083194715:web:bd047c99fa738731ac287e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

export {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

export {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

