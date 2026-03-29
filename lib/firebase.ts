// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Проверяем, что мы на клиенте (браузер)
const isClient = typeof window !== 'undefined';

// Функция для получения конфигурации Firebase
const getFirebaseConfig = () => {
  // Для серверного рендеринга (SSR) возвращаем пустой конфиг
  // Firebase не нужен на сервере для аутентификации
  if (!isClient) {
    return null;
  }

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Проверяем наличие всех переменных
  const missingVars = Object.entries(config).filter(([_, value]) => !value);
  if (missingVars.length > 0) {
    console.error('Missing Firebase config variables:', missingVars.map(([key]) => key));
    return null;
  }

  return config;
};

// Инициализация Firebase только на клиенте
let app = null;
let auth = null;
let db = null;

if (isClient) {
  const firebaseConfig = getFirebaseConfig();
  
  if (firebaseConfig) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Включаем оффлайн-персистенс только на клиенте
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence');
      }
    });
  }
}

export { auth, db };
export const googleProvider = auth ? new GoogleAuthProvider() : null;