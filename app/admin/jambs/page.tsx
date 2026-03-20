'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  User, 
  Hash, 
  FileText, 
  ShieldAlert, 
  Plus, 
  Filter,
  Calendar,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

interface Jamb {
  id: string;
  employeeEmail: string;
  orderNumber?: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt: string;
  createdBy: string;
}

interface UserProfile {
  email: string;
  displayName?: string;
  role: string;
}

export default function JambsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [jambs, setJambs] = useState<Jamb[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');

  // Filters
  const [filterEmployee, setFilterEmployee] = useState('');

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/employee');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (role !== 'admin') return;

    // Fetch jambs
    const jambsQuery = query(collection(db, 'jambs'), orderBy('createdAt', 'desc'));
    const unsubscribeJambs = onSnapshot(jambsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jamb));
      setJambs(data);
      setLoading(false);
    }, (error) => {
      console.error('Firestore Error in Jambs:', error);
      setLoading(false);
    });

    // Fetch employees
    const fetchEmployees = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const data = usersSnap.docs.map(doc => doc.data() as UserProfile);
        // Include both employees and admins in the selection list
        setEmployees(data);
      } catch (err) {
        console.error('Error fetching employees:', err);
      }
    };
    fetchEmployees();

    return () => unsubscribeJambs();
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !employeeEmail || !description) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'jambs'), {
        employeeEmail,
        orderNumber: orderNumber || null,
        description,
        severity,
        createdAt: new Date().toISOString(),
        createdBy: user.email
      });
      
      setSuccess(true);
      setEmployeeEmail('');
      setOrderNumber('');
      setDescription('');
      setSeverity('Medium');
      setTimeout(() => {
        setSuccess(false);
        setShowForm(false);
      }, 2000);
    } catch (err) {
      console.error('Error adding jamb:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredJambs = jambs.filter(j => 
    !filterEmployee || j.employeeEmail === filterEmployee
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Модуль JAMBS</h1>
              <p className="text-slate-500">Учет и анализ ошибок сотрудников</p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-100 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Регистрация ошибки
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Фильтры:</span>
          </div>
          <select 
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все сотрудники</option>
            {employees.map(emp => (
              <option key={emp.email} value={emp.email}>{emp.displayName || emp.email}</option>
            ))}
          </select>
        </div>

        {/* Jambs List */}
        <div className="space-y-4">
          {filteredJambs.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl text-center border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Ошибок не найдено. Отличная работа!</p>
            </div>
          ) : (
            filteredJambs.map((jamb) => (
              <motion.div 
                key={jamb.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6"
              >
                <div className={`w-2 h-full absolute left-0 top-0 rounded-l-2xl ${
                  jamb.severity === 'Critical' ? 'bg-red-600' :
                  jamb.severity === 'High' ? 'bg-orange-500' :
                  jamb.severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-400'
                }`} />
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{jamb.employeeEmail}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(jamb.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      jamb.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                      jamb.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                      jamb.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {jamb.severity}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-slate-700 text-sm leading-relaxed">{jamb.description}</p>
                  </div>

                  {jamb.orderNumber && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Hash className="w-3 h-3" />
                      Заказ: <span className="font-mono font-bold text-slate-700">{jamb.orderNumber}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
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
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                  Регистрация ошибки
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
                    <p className="text-lg font-bold text-slate-900">Ошибка зарегистрирована</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1">Сотрудник</label>
                      {employees.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>Сотрудники не найдены. <Link href="/admin/users" className="underline font-bold">Добавьте их здесь</Link></span>
                        </div>
                      ) : (
                        <select 
                          required
                          value={employeeEmail}
                          onChange={(e) => setEmployeeEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Выберите сотрудника</option>
                          {employees.map(emp => (
                            <option key={emp.email} value={emp.email}>{emp.displayName || emp.email}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1">Номер заказа (опционально)</label>
                      <input 
                        type="text"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="Напр. 123456"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1">Тяжесть</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Low', 'Medium', 'High', 'Critical'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSeverity(s as any)}
                            className={`py-2 rounded-lg text-xs font-bold transition-all ${
                              severity === s 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1">Описание</label>
                      <textarea 
                        required
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Опишите ситуацию..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Зарегистрировать'}
                    </button>
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
