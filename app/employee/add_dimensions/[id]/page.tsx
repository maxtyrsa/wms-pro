'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
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

// Изменяем интерфейс, чтобы стейт мог временно держать строку при вводе
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
    // Разрешаем ввод пустой строки, точки или нуля в начале для дробных чисел
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

  const handleSave = async () => {
    // Валидация: переводим в числа перед проверкой
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

    if (!id || !user) return;
    setSaving(true);
    setError(null);

    try {
      const docRef = doc(db, 'orders', id as string);
      const status = 'Ожидает оформления';
      const timestamp = new Date().toISOString();
      
      // Преобразуем все данные в числа перед отправкой в Firebase
      const numericPlaces = places.map(p => ({
        d: parseFloat(String(p.d)),
        w: parseFloat(String(p.w)),
        h: parseFloat(String(p.h)),
        weight: parseFloat(String(p.weight)),
      }));

      await updateDoc(docRef, {
        places_data: numericPlaces,
        totalVolume: parseFloat(totals.volume),
        totalWeight: parseFloat(totals.weight),
        status,
        history: arrayUnion({
          status,
          timestamp,
          user: user.email
        })
      });
      router.push('/');
    } catch (err) {
      console.error('Error saving dimensions:', err);
      setError('Ошибка при сохранении данных');
    } finally {
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

  if (!order) {
    return (
      <div className="min-h-screen p-4 bg-slate-50">
        <div className="bg-white p-8 rounded-2xl text-center border border-slate-200">
          <p className="text-slate-600">Заказ не найден</p>
          <Link href="/" className="mt-4 text-blue-600 inline-block">Вернуться на главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Габариты заказа</h1>
            <p className="text-xs text-slate-500">{order.orderNumber || 'Без номера'} · {order.quantity} мест</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Итого</p>
          <p className="text-sm font-bold text-slate-900">{totals.volume} м³ · {totals.weight} кг</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2>Групповой ввод</h2>
          </div>
          
          <div className="space-y-3">
            <input 
              type="text"
              placeholder="Диапазон (напр. 1-3, 5)"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
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
                  className="px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={parseGroupInput} className="py-3 bg-blue-600 text-white rounded-xl font-bold text-sm">Применить к группе</button>
              <button onClick={applyToAll} className="py-3 bg-white border border-blue-600 text-blue-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" /> Всем как №1
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {places.map((place, index) => (
            <div key={index} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Место №{index + 1}</span>
                <div className="text-[10px] text-slate-400">
                  {((parseFloat(String(place.d)) * parseFloat(String(place.w)) * parseFloat(String(place.h)) || 0) / 1000000).toFixed(4)} м³
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Длина', field: 'd' },
                  { label: 'Ширина', field: 'w' },
                  { label: 'Высота', field: 'h' },
                  { label: 'Вес', field: 'weight' }
                ].map((col) => (
                  <div key={col.field} className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase ml-1">{col.label}</label>
                    <input 
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={place[col.field as keyof PlaceData]}
                      onChange={(e) => handleInputChange(index, col.field as keyof PlaceData, e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-center font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-30">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6" /> Сохранить и оформить</>}
          </button>
        </div>
      </div>
    </div>
  );
}