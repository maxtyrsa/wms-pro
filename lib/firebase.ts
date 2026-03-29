import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAnalytics, Analytics, isSupported } from "firebase/analytics";

// 1. Конфигурация из переменных окружения
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 2. Инициализация приложения (защита от дубликатов)
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 3. Экспорт сервисов (всегда объекты, чтобы не было ошибки "reading property of null")
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 4. Инициализация аналитики (только в браузере)
export let analytics: Promise<Analytics | null> = isSupported().then((supported) => 
  supported ? getAnalytics(app) : null
).catch(() => null);

// 5. Включение оффлайн-персистенции для Firestore (Client-side only)
if (typeof window !== "undefined") {
  const { enableIndexedDbPersistence } = require("firebase/firestore");
  enableIndexedDbPersistence(db).catch((err: any) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence is not supported by this browser.');
    }
  });
}

export { app };