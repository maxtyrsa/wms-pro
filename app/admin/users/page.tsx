'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  setDoc, 
  doc, 
  query, 
  onSnapshot, 
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  X,
  AlertCircle,
  Edit2,
  ArrowLeft
} from 'lucide-react';

interface UserProfile {
  email: string;
  displayName?: string;
  role: 'admin' | 'employee';
}

export default function UsersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'employee'>('employee');

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (role !== 'admin') return;

    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching users:', err);
      setError('Ошибка при загрузке пользователей');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setError(null);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const userRef = doc(db, 'users', normalizedEmail);
      
      await setDoc(userRef, {
        email: normalizedEmail,
        displayName: displayName.trim() || null,
        role: userRole
      });
      
      setSuccess(true);
      setEmail('');
      setDisplayName('');
      setUserRole('employee');
      setEditingUser(null);
      
      setTimeout(() => {
        setSuccess(false);
        setShowForm(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error saving user:', err);
      setError(err.message || 'Ошибка при сохранении пользователя');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (email === 'maximtyrsa89@gmail.com') {
      alert('Нельзя удалить главного администратора');
      return;
    }
    if (!confirm(`Вы уверены, что хотите удалить пользователя ${email}?`)) return;

    try {
      await deleteDoc(doc(db, 'users', email));
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Ошибка при удалении');
    }
  };

  const openEdit = (u: UserProfile) => {
    setEditingUser(u);
    setEmail(u.email);
    setDisplayName(u.displayName || '');
    setUserRole(u.role);
    setShowForm(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Управление пользователями</h1>
              <p className="text-slate-500">Добавление и редактирование прав доступа</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setEditingUser(null);
              setEmail('');
              setDisplayName('');
              setUserRole('employee');
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
            Добавить пользователя
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Пользователь</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Роль</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    Пользователи не найдены. Добавьте первого сотрудника.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.email} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.displayName || 'Без имени'}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {u.role === 'admin' ? 'Админ' : 'Сотрудник'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEdit(u)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(u.email)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {editingUser ? <Edit2 className="w-6 h-6 text-blue-600" /> : <UserPlus className="w-6 h-6 text-blue-600" />}
                  {editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {success ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">Данные сохранены</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email (Google Account)</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                          type="email"
                          required
                          disabled={!!editingUser}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="example@gmail.com"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1">Имя (отображаемое)</label>
                      <input 
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Иван Иванов"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1">Роль</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setUserRole('employee')}
                          className={`py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            userRole === 'employee' 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                          Сотрудник
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserRole('admin')}
                          className={`py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            userRole === 'admin' 
                              ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' 
                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <Shield className="w-4 h-4" />
                          Админ
                        </button>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingUser ? 'Сохранить изменения' : 'Добавить пользователя')}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
