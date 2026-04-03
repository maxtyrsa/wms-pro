'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';
import { ArrowLeft, Package, Truck, Building2, Hash, Loader2, Save, Edit2 } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const DEPT_CARRIERS: Record<string, string[]> = {
  'KF': ['CDEK', 'DPD', 'Деловые линии', 'Почта России', 'ПЭК', 'Самовывоз'],
  'MP': ['OZON_FBS', 'WB_FBS', 'Yandex Market', 'AliExpress', 'Ярмарка Мастеров', 'OZON_FBO', 'WB_FBO'],
  'Pack Stage': ['CDEK', 'Самовывоз']
};

const DEPARTMENTS = Object.keys(DEPT_CARRIERS);

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);

  const [formData, setFormData] = useState({
    orderNumber: '',
    quantity: 1,
    department: '',
    carrier: '',
  });

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!id) {
      setError('ID заказа не указан');
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder(data);
          setFormData({
            orderNumber: data.orderNumber || '',
            quantity: data.quantity || 1,
            department: data.department || '',
            carrier: data.carrier || '',
          });
        } else {
          setError('Заказ не найден');
        }
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(err.message || 'Ошибка загрузки заказа');
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
  }, [id]);

  const availableCarriers = formData.department ? DEPT_CARRIERS[formData.department] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.department || !formData.carrier) {
      setError('Пожалуйста, выберите подразделение и ТК');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const orderRef = doc(db, 'orders', id);
      await updateDoc(orderRef, {
        orderNumber: formData.orderNumber || null,
        quantity: Number(formData.quantity),
        department: formData.department,
        carrier: formData.carrier,
        lastEdited: new Date().toISOString(),
        lastEditedBy: user?.email
      });

      showToast('Заказ успешно обновлен', 'success');
      
      // После редактирования перенаправляем на страницу ввода габаритов
      router.push(`/employee/add_dimensions/${id}`);
    } catch (err: any) {
      console.error('Error updating order:', err);
      setError(err.message || 'Ошибка при сохранении изменений');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              Редактирование заказа
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Администратор' : 'Сотрудник'} может изменить данные перед вводом габаритов
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-lg mx-auto p-4">
        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800"
        >
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              <Hash className="w-4 h-4 text-blue-500" />
              Номер заказа
            </label>
            <input
              type="text"
              value={formData.orderNumber}
              onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
              placeholder="Например: 12345"
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              <Package className="w-4 h-4 text-blue-500" />
              Количество мест *
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
              placeholder="0"
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              <Building2 className="w-4 h-4 text-blue-500" />
              Подразделение *
            </label>
            <div className="flex gap-2">
              {DEPARTMENTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFormData({ ...formData, department: d, carrier: '' })}
                  className={`flex-1 p-4 text-center rounded-2xl border transition-all text-sm font-bold shadow-sm ${
                    formData.department === d 
                      ? 'bg-slate-900 dark:bg-slate-700 border-slate-900 dark:border-slate-600 text-white ring-2 ring-slate-300 dark:ring-slate-600' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-2 transition-opacity duration-300 ${!formData.department ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
              <Truck className="w-4 h-4 text-blue-500" />
              Транспортная компания *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {availableCarriers.length > 0 ? (
                availableCarriers.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, carrier: c })}
                    className={`p-4 text-left rounded-2xl border transition-all flex items-center justify-between shadow-sm ${
                      formData.carrier === c 
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 dark:border-blue-600 text-blue-700 dark:text-blue-300 ring-2 ring-blue-100 dark:ring-blue-900' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="font-semibold">{c}</span>
                    {formData.carrier === c && (
                      <motion.div layoutId="dot" className="w-3 h-3 bg-blue-500 rounded-full shadow-sm" />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-sm italic border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  Сначала выберите подразделение
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !formData.carrier}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Продолжить
            </button>
          </div>
        </motion.form>
      </main>
    </div>
  );
}