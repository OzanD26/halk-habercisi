// firebaseConfig.js
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyB4Kqph4-riTcggR-l7VNSXK_qniWuRVgE',
  authDomain: 'halk-habercisi.firebaseapp.com',
  projectId: 'halk-habercisi',
  storageBucket: 'halk-habercisi.firebasestorage.app',
  messagingSenderId: '510308493559',
  appId: '1:510308493559:web:20e24620dee83d1c8d4bf2',
};

// ---- App (tek defa) ----
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// ---- Firestore (RN için long-polling) ----
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
    longPollingOptions: { timeoutSeconds: 30 },
  });
} catch {
  db = getFirestore(app);
}
setLogLevel('error');

// ---- Storage / Auth ----
const storage = getStorage(app);
const auth = getAuth(app);

// Anonim auth hazır olana kadar bekleten helper
export const ensureAuthReady = new Promise((resolve, reject) => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    if (user) { console.log('🔐 uid:', user.uid); unsub(); resolve(user); return; }
    try {
      const cred = await signInAnonymously(auth);
      console.log('🔐 anon uid:', cred.user.uid);
    } catch (e) {
      console.log('auth error', e);
      reject(e);
    }
  });
});

// Teşhis için
export const debugFirebaseInfo = () => {
  const o = app?.options || {};
  console.log('🔥 Firebase info -> projectId:', o.projectId, 'bucket:', o.storageBucket);
  return o;
};

export { app, db, storage, auth };
