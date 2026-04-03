'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  role: 'admin' | 'employee' | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<'admin' | 'employee' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect result error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Домен не авторизован в Firebase Console. Пожалуйста, добавьте текущий URL в список разрешенных доменов для авторизации.');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);

      if (firebaseUser) {
        try {
          const email = firebaseUser.email?.toLowerCase();
          if (!email) {
            throw new Error('Email не найден в аккаунте');
          }
          const userDocRef = doc(db, 'users', email);
          const userDoc = await getDoc(userDocRef);
          
          const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'maximtyrsa89@gmail.com';
          const isSuperAdmin = email === SUPER_ADMIN_EMAIL;

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser(firebaseUser);
            setRole(userData.role as 'admin' | 'employee');
          } else if (isSuperAdmin) {
            // Создаем запись для суперадмина
            await setDoc(userDocRef, {
              email: email,
              displayName: firebaseUser.displayName || 'Администратор',
              role: 'admin'
            });
            setUser(firebaseUser);
            setRole('admin');
          } else {
            setUser(null);
            setRole(null);
            setError(`Доступ запрещен. Email ${email} не найден в системе. Обратитесь к администратору.`);
            await signOut(auth);
          }
        } catch (err) {
          console.error('Auth error:', err);
          await signOut(auth);
          setUser(null);
          setRole(null);
          setError('Ошибка при проверке прав доступа');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Всплывающее окно заблокировано. Попробуйте войти через редирект.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.log('Cancelled popup request');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Окно входа было закрыто пользователем.');
      } else {
        setError(err.message || 'Ошибка входа');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogleRedirect = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error('Redirect error:', err);
      setError(err.message || 'Ошибка редиректа');
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      const userDocRef = doc(db, 'users', email.toLowerCase());
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await signOut(auth);
        setError('Пользователь не найден в системе. Обратитесь к администратору.');
        return;
      }
      
      const userData = userDoc.data();
      if (userData.role !== 'admin' && userData.role !== 'employee') {
        await signOut(auth);
        setError('Недостаточно прав для входа');
        return;
      }
    } catch (err: any) {
      console.error('Email login error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Пользователь не найден');
      } else if (err.code === 'auth/wrong-password') {
        setError('Неверный пароль');
      } else if (err.code === 'auth/invalid-email') {
        setError('Неверный формат email');
      } else {
        setError(err.message || 'Ошибка входа');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Пользователь не найден');
      } else if (err.code === 'auth/invalid-email') {
        setError('Неверный формат email');
      } else {
        setError(err.message || 'Ошибка отправки письма');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, role, loading, error, 
      signInWithGoogle, 
      signInWithGoogleRedirect,
      signInWithEmail,
      resetPassword,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}