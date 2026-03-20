'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrderById, updateOrderMoney } from '@/lib/orders';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Banknote, Truck, Calculator, Plus } from 'lucide-react';

export default function AddMoneyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentSum, setPaymentSum] = useState<number>(0);
  const [deliveryCost, setDeliveryCost] = useState<number>(0);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const data = await getOrderById(id);
        setOrder(data);
        // Pre-fill if already exists
        if (data.payment_sum) setPaymentSum(data.payment_sum);
        if (data.delivery_cost) setDeliveryCost(data.delivery_cost);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки заказа');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id]);

  const profit = paymentSum - deliveryCost;

  const handleQuickAdd = (amount: number) => {
    setPaymentSum(prev => prev + amount);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrderMoney(id, {
        payment_sum: paymentSum,
        delivery_cost: deliveryCost,
        profit: profit,
      });
      router.push(`/employee/assembly/${id}`);
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen p-4 bg-slate-50">
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Оплата заказа</h1>
          <p className="text-sm text-slate-500">№ {order?.orderNumber || 'Без номера'} • {order?.carrier}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Payment Sum */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Banknote className="w-4 h-4" />
              Сумма оплаты
            </label>
            <div className="relative">
              <input
                type="number"
                value={paymentSum || ''}
                onChange={(e) => setPaymentSum(Number(e.target.value))}
                className="w-full text-5xl font-black text-slate-900 p-0 border-none focus:ring-0 outline-none placeholder:text-slate-200"
                placeholder="0"
              />
              <span className="absolute right-0 bottom-2 text-2xl font-bold text-slate-400">₽</span>
            </div>

            {/* Quick Buttons */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[100, 500, 1000, 5000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickAdd(amount)}
                  className="bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all py-3 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Cost */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Truck className="w-4 h-4" />
              Стоимость доставки
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={deliveryCost || ''}
                onChange={(e) => setDeliveryCost(Number(e.target.value))}
                className="w-full text-3xl font-bold text-slate-900 p-0 border-none focus:ring-0 outline-none placeholder:text-slate-200"
                placeholder="0"
              />
              <span className="text-xl font-bold text-slate-400">₽</span>
            </div>
          </div>

          {/* Profit */}
          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Чистая прибыль
              </span>
            </div>
            <div className="text-4xl font-black text-white">
              {profit.toLocaleString()} <span className="text-2xl font-bold text-slate-500">₽</span>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {saving ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Продолжить к сборке'
            )}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
