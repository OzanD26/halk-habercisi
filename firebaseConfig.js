
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: "AIzaSyB4Kqph4-riTcggR-l7VNSXK_qniWuRVgE",
  authDomain: "halk-habercisi.firebaseapp.com",
  projectId: "halk-habercisi",
  storageBucket: "halk-habercisi.appspot.com", 
  messagingSenderId: "510308493559",
  appId: "1:510308493559:web:20e24620dee83d1c8d4bf2"
 
};


const app = initializeApp(firebaseConfig);


export const db = getFirestore(app);
export const storage = getStorage(app);
