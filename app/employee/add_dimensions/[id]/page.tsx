'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Save, 
  Layers, 
  Copy, 
  Info,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { showToast } from '@/components/Toast';
// 🔥 Импортируем функцию для сохранения габаритов с обновлением статуса
import { saveDimensionsAndUpdateStatus } from '@/lib/orders';

interface PlaceData {
  d: number | string;
  w: number | string;
  h: number | string;
  weight: number | string;
}

interface OrderData {
  orderNumber?: string;
  quantity: number;
  carrier: string;
  status: string;
}

export default function AddDimensionsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [groupInput, setGroupInput] = useState('');
  const [groupD, setGroupD] = useState('');
  const [groupW, setGroupW] = useState('');
  const [groupH, setGroupH] = useState('');
  const [groupWeight, setGroupWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, 'orders', id as string);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as OrderData;
        setOrder(data);
        
        setPlaces(prev => {
          if (prev.length === 0) {
            return Array(data.quantity).fill(null).map(() => ({
              d: '',
              w: '',
              h: '',
              weight: ''
            }));
          }
          return prev;
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const totals = useMemo(() => {
    let totalVolume = 0;
    let totalWeight = 0;
    places.forEach(p => {
      const d = parseFloat(String(p.d)) || 0;
      const w = parseFloat(String(p.w)) || 0;
      const h = parseFloat(String(p.h)) || 0;
      const weight = parseFloat(String(p.weight)) || 0;

      const v = (d * w * h) / 1000000;
      totalVolume += isNaN(v) ? 0 : v;
      totalWeight += weight;
    });
    return {
      volume: totalVolume === 0 ? "0.0000" : totalVolume.toFixed(4),
      weight: totalWeight.toFixed(2)
    };
  }, [places]);

  const handleInputChange = (index: number, field: keyof PlaceData, value: string) => {
    const newPlaces = [...places];
    newPlaces[index] = { ...newPlaces[index], [field]: value };
    setPlaces(newPlaces);
  };

  const applyToAll = () => {
    if (places.length === 0) return;
    const first = places[0];
    const newPlaces = places.map(() => ({ ...first }));
    setPlaces(newPlaces);
  };

  const parseGroupInput = () => {
    if (!groupInput.trim()) return;
    
    const indices: number[] = [];
    const parts = groupInput.split(',').map(p => p.trim());
    
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= places.length) indices.push(i - 1);
          }
        }
      } else {
        const n = parseInt(part);
        if (!isNaN(n) && n >= 1 && n <= places.length) {
          indices.push(n - 1);
        }
      }
    });

    if (indices.length === 0) {
      setError('Некорректный диапазон');
      return;
    }

    const newPlaces = [...places];
    indices.forEach(idx => {
      newPlaces[idx] = {
        d: groupD !== '' ? groupD : newPlaces[idx].d,
        w: groupW !== '' ? groupW : newPlaces[idx].w,
        h: groupH !== '' ? groupH : newPlaces[idx].h,
        weight: groupWeight !== '' ? groupWeight : newPlaces[idx].weight,
      };
    });
    setPlaces(newPlaces);
    setError(null);
  };

  // 🔥 ИСПРАВЛЕНО: Используем функцию saveDimensionsAndUpdateStatus из lib/orders
  const handleSave = async () => {
    // Валидация максимального веса места (25 кг)
    const MAX_WEIGHT_PER_PLACE = 25;
    
    const invalidPlace = places.find(p => parseFloat(String(p.weight)) > MAX_WEIGHT_PER_PLACE);
    
    if (invalidPlace) {
      const placeIndex = places.indexOf(invalidPlace) + 1;
      setError(`Ошибка: Вес места №${placeIndex} превышает ${MAX_WEIGHT_PER_PLACE} кг.`);
      showToast(`Вес одного места не может превышать ${MAX_WEIGHT_PER_PLACE} кг`, 'error');
      return;
    }

    // Валидация на отрицательные/нулевые значения
    const invalid = places.some(p => 
      parseFloat(String(p.d)) <= 0 || 
      parseFloat(String(p.w)) <= 0 || 
      parseFloat(String(p.h)) <= 0 || 
      parseFloat(String(p.weight)) <= 0
    );

    if (invalid) {
      setError('Все габариты и вес должны быть больше нуля');
      return;
    }

    if (!id || !user?.email) {
      setError('Ошибка авторизации');
      showToast('Ошибка авторизации', 'error');
      return;
    }
    
    setSaving(true);
    setError(null);

    try {
      const numericPlaces = places.map(p => ({
        d: parseFloat(String(p.d)),
        w: parseFloat(String(p.w)),
        h: parseFloat(String(p.h)),
        weight: parseFloat(String(p.weight)),
      }));

      // 🔥 Используем централизованную функцию с записью в историю
      await saveDimensionsAndUpdateStatus(
        id as string,
        user.email,
        numericPlaces,
        parseFloat(totals.volume),
        parseFloat(totals.weight)
      );
      
      showToast('Габариты сохранены, заказ ожидает оформления', 'success');
      router.push('/');
    } catch (err) {
      console.error('Error saving dimensions:', err);
      setError('Ошибка при сохранении данных');
      showToast('Ошибка при сохранении данных', 'error');
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

  if (!order) {
    return (
      <div className="min-h-screen p-4 bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl text-center border border-slate-200 dark:border-slate-800">
          <p className="text-slate-600 dark:text-slate-400">Заказ не найден</p>
          <Link href="/" className="mt-4 text-blue-600 dark:text-blue-400 inline-block">Вернуться на главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Габариты заказа</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{order.orderNumber || 'Без номера'} · {order.quantity} мест</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Итого</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{totals.volume} м³ · {totals.weight} кг</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <section className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2>Групповой ввод</h2>
          </div>
          
          <div className="space-y-3">
            <input 
              type="text"
              placeholder="Диапазон (напр. 1-3, 5)"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm"
            />

            <div className="grid grid-cols-4 gap-2">
              {['Д', 'Ш', 'В', 'Вес'].map((label, i) => (
                <input 
                  key={label}
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder={label}
                  value={[groupD, groupW, groupH, groupWeight][i]}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (i === 0) setGroupD(v);
                    if (i === 1) setGroupW(v);
                    if (i === 2) setGroupH(v);
                    if (i === 3) setGroupWeight(v);
                  }}
                  className="px-2 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={parseGroupInput} className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">Применить к группе</button>
              <button onClick={applyToAll} className="py-3 bg-white dark:bg-slate-800 border border-blue-600 text-blue-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                <Copy className="w-4 h-4" /> Всем как №1
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {places.map((place, index) => (
            <div key={index} className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Место №{index + 1}</span>
                <div className="text-[10px] text-slate-400">
                  {((parseFloat(String(place.d)) * parseFloat(String(place.w)) * parseFloat(String(place.h)) || 0) / 1000000).toFixed(4)} м³
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Длина', field: 'd' as keyof PlaceData },
                  { label: 'Ширина', field: 'w' as keyof PlaceData },
                  { label: 'Высота', field: 'h' as keyof PlaceData },
                  { label: 'Вес', field: 'weight' as keyof PlaceData }
                ].map((col) => (
                  <div key={col.field} className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase ml-1">{col.label}</label>
                    <input 
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={place[col.field]}
                      onChange={(e) => handleInputChange(index, col.field, e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-center font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 transition-colors shadow-lg shadow-blue-200 dark:shadow-blue-950/30"
          >
            {saving ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Save className="w-6 h-6" /> 
                Сохранить и оформить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}