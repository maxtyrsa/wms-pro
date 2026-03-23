'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
  FileDown, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  ArrowLeft,
  Home
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber?: string;
  carrier: string;
  quantity: number;
  status: string;
  createdAt: string;
  createdBy: string;
  time_start?: any;
  time_end?: any;
  places_data?: Array<{ d: number; w: number; h: number; weight: number }>;
  totalWeight?: number;
  totalVolume?: number;
  payment_sum?: number;
  delivery_cost?: number;
  profit?: number;
}

// Функция для получения времени в миллисекундах
const getTimeMs = (time: any): number => {
  if (!time) return 0;
  if (typeof time.toDate === 'function') {
    return time.toDate().getTime();
  }
  if (typeof time === 'string') {
    return new Date(time).getTime();
  }
  if (typeof time === 'number') {
    return time;
  }
  return 0;
};

// Функция для форматирования времени сборки
const formatAssemblyTime = (start: any, end: any): string => {
  if (!start || !end) return '—';
  const startMs = getTimeMs(start);
  const endMs = getTimeMs(end);
  if (startMs === 0 || endMs === 0 || endMs <= startMs) return '—';
  const diffSeconds = Math.floor((endMs - startMs) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function ReportsPage() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [exporting, setExporting] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/employee');
    }
  }, [authLoading, role, router]);

  const generateReport = async () => {
    setExporting(true);
    setError(null);

    try {
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef, 
        where('createdAt', '>=', new Date(startDate).toISOString()),
        where('createdAt', '<=', new Date(endDate + 'T23:59:59').toISOString()),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

      if (orders.length === 0) {
        setError('За указанный период заказов не найдено');
        setExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Отчет по заказам');

      // Columns
      worksheet.columns = [
        { header: 'ID Заказа', key: 'id', width: 25 },
        { header: 'Номер заказа', key: 'orderNumber', width: 15 },
        { header: 'ТК', key: 'carrier', width: 15 },
        { header: 'Статус', key: 'status', width: 15 },
        { header: 'Дата создания', key: 'createdAt', width: 20 },
        { header: 'Сотрудник', key: 'createdBy', width: 25 },
        { header: 'Кол-во мест', key: 'quantity', width: 12 },
        { header: 'Общий вес (кг)', key: 'totalWeight', width: 15 },
        { header: 'Общий объем (м³)', key: 'totalVolume', width: 15 },
        { header: 'Время сборки', key: 'assemblyTime', width: 15 },
        { header: 'Сумма оплаты (₽)', key: 'paymentSum', width: 15 },
        { header: 'Стоимость доставки (₽)', key: 'deliveryCost', width: 18 },
        { header: 'Прибыль (₽)', key: 'profit', width: 15 },
        { header: 'Детализация мест', key: 'placesDetail', width: 60 },
      ];

      // Styling header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };

      // Add rows
      orders.forEach(order => {
        // Расчет времени сборки
        const assemblyTime = formatAssemblyTime(order.time_start, order.time_end);
        
        // Расчет общего веса и объема из мест, если нет прямых значений
        let totalWeight = order.totalWeight || 0;
        let totalVolume = order.totalVolume || 0;
        let placesDetail = '';
        
        if (order.places_data && order.places_data.length > 0) {
          // Пересчитываем вес и объем из мест
          let calcWeight = 0;
          let calcVolume = 0;
          const placesStrings: string[] = [];
          
          order.places_data.forEach((place, i) => {
            const d = place.d || 0;
            const w = place.w || 0;
            const h = place.h || 0;
            const weight = place.weight || 0;
            
            calcWeight += weight;
            calcVolume += (d * w * h) / 1000000;
            
            placesStrings.push(
              `Место ${i+1}: ${d}×${w}×${h} см, ${weight} кг`
            );
          });
          
          totalWeight = calcWeight;
          totalVolume = calcVolume;
          placesDetail = placesStrings.join(' | ');
        }

        worksheet.addRow({
          id: order.id,
          orderNumber: order.orderNumber || '—',
          carrier: order.carrier,
          status: order.status,
          createdAt: new Date(order.createdAt).toLocaleString(),
          createdBy: order.createdBy,
          quantity: order.quantity,
          totalWeight: totalWeight.toFixed(2),
          totalVolume: totalVolume.toFixed(6),
          assemblyTime,
          paymentSum: order.payment_sum?.toLocaleString() || 0,
          deliveryCost: order.delivery_cost?.toLocaleString() || 0,
          profit: order.profit?.toLocaleString() || 0,
          placesDetail
        });
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `WMS_Report_${startDate}_to_${endDate}.xlsx`);

    } catch (err) {
      console.error('Export error:', err);
      setError('Ошибка при генерации отчета');
    } finally {
      setExporting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Кнопка возврата на главную */}
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="На главную"
            >
              <Home className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Отчеты</h1>
              <p className="text-slate-500 dark:text-slate-400">Экспорт данных в Excel формат</p>
            </div>
          </div>
          <FileSpreadsheet className="w-10 h-10 text-emerald-600 dark:text-emerald-500 opacity-20" />
        </header>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Дата начала
              </label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Дата окончания
              </label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium dark:text-white"
              />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-4">
            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-blue-900 dark:text-blue-300">XLSX Отчет</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
                Файл будет содержать полную информацию о заказах: номера, ТК, габариты, вес, данные о сотрудниках, времени сборки, а также финансовые показатели (сумма оплаты, доставка, прибыль).
              </p>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-300 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          <button 
            onClick={generateReport}
            disabled={exporting}
            className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 dark:shadow-emerald-950/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <FileDown className="w-6 h-6" />
                Скачать отчет (.xlsx)
              </>
            )}
          </button>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 opacity-50 grayscale">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center gap-4">
            <Clock className="w-8 h-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Автоматическая рассылка (скоро)</p>
          </div>
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center gap-4">
            <Package className="w-8 h-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Интеграция с 1С (скоро)</p>
          </div>
        </div>
      </div>
    </div>
  );
}