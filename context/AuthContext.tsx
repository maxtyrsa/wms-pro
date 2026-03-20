'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  role: 'admin' | 'employee' | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<'admin' | 'employee' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle redirect result
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
            throw new Error('Email not found in Google account');
          }
          const userDocRef = doc(db, 'users', email);
          const userDoc = await getDoc(userDocRef);
          
          const isSuperAdmin = email === 'maximtyrsa89@gmail.com';

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser(firebaseUser);
            setRole(userData.role as 'admin' | 'employee');
          } else if (isSuperAdmin) {
            // Bootstrap admin: allow access and set role
            setUser(firebaseUser);
            setRole('admin');
          } else {
            // Security constraint: email must exist in users collection
            setUser(null);
            setRole(null);
            setError('DEBUG: email=[' + email + '] isSuperAdmin=' + isSuperAdmin + '. Доступ запрещен. Обратитесь к администратору.');
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
        setError('Всплывающее окно заблокировано. Попробуйте войти через редирект или откройте приложение в новой вкладке.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // This is often a benign error if another request was started
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

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, error, signInWithGoogle, signInWithGoogleRedirect, logout }}>
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
