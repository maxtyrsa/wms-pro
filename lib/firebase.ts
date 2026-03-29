import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

// 1. Конфигурация (обязательно с префиксом NEXT_PUBLIC_)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 2. Инициализация App (Singleton паттерн)
// Если приложение уже инициализировано, берем существующее, иначе создаем новое
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 3. Инициализация сервисов
export const auth: Auth = getAuth(app);

// Используем initializeFirestore вместо getFirestore для более тонкой настройки (необязательно)
export const db: Firestore = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// 4. Безопасное включение оффлайн-режима (Persistence)
// Важно: в Next.js это должно вызываться только на стороне клиента
if (typeof window !== 'undefined') {
  const { enableIndexedDbPersistence } = require('firebase/firestore');
  
  enableIndexedDbPersistence(db).catch((err: any) => {
    if (err.code === 'failed-precondition') {
      // Вероятно, открыто несколько вкладок
      console.warn('Firestore persistence failed: Multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      // Браузер не поддерживает (например, очень старый или приватный режим)
      console.warn('Firestore persistence is not supported by this browser.');
    }
  });
}

export { app };