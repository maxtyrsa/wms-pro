'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import Image from 'next/image';
import { LogIn, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithGoogleRedirect, error, loading } = useAuth();
  const router = useRouter();
  const [isIframe, setIsIframe] = React.useState(false);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    // Detect if running in an iframe
    const timer = setTimeout(() => {
      setIsIframe(window.self !== window.top);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[480px] bg-white rounded-2xl shadow-xl p-8 border border-slate-200"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <LogIn className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WMS Kupi-Flakon</h1>
          <p className="text-slate-500 text-sm mt-1">Система управления Московским складом</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col gap-3 text-red-700 text-sm"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
            {error.includes('заблокировано') && (
              <div className="flex flex-col gap-2 ml-8">
                <button 
                  onClick={signInWithGoogleRedirect}
                  className="text-blue-600 font-semibold hover:underline text-left"
                >
                  Использовать редирект →
                </button>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 font-semibold hover:underline text-left"
                >
                  Открыть в новой вкладке →
                </a>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 py-3 px-4 rounded-xl font-semibold text-blue-600 hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Image 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <span>Войти через Google</span>
          </button>

          {isIframe && (
            <button
              onClick={signInWithGoogleRedirect}
              disabled={loading}
              className="w-full py-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
            >
              Проблемы со входом? Попробуйте редирект
            </button>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Для доступа к системе обратитесь к вашему менеджеру
          </p>
        </div>
      </motion.div>
    </div>
  );
}
