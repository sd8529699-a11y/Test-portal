
import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export const saveStudentData = async (email, data) => {
  await setDoc(doc(db, "students", email), data);
};

export const getStudentData = async (email) => {
  const docRef = doc(db, "students", email);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};
