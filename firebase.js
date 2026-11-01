
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDDJVnmQdgLm_zXq1I_p7i9ca7l2nFt4J8",
  authDomain: "exam-portal-18495.firebaseapp.com",
  projectId: "exam-portal-18495",
  storageBucket: "exam-portal-18495.firebasestorage.app",
  messagingSenderId: "785313781415",
  appId: "1:785313781415:web:323746970a2d0d309a6d82",
  measurementId: "G-PCPBDSP1KS"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);