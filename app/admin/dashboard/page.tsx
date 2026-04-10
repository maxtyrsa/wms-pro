// app/admin/dashboard/page.tsx
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentMonthRange } from '@/lib/dateUtils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart
} from 'recharts';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Clock, 
  Weight, 
  Layers, 
  Package,
  Loader2,
  Calendar,
  ArrowLeft,
  Truck,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfDay, endOfDay, eachDayOfInterval, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { showToast } from '@/components/Toast';

interface Order {
  id: string;
  status: string;
  createdAt: any;
  time_start?: any;
  time_end?: any;
  totalWeight?: number;
  totalVolume?: number;
  createdBy: string;
  payment_sum?: number;
  delivery_cost?: number;
  profit?: number;
  carrier: string;
  orderNumber?: string;
}

interface Jamb {
  id: string;
  employeeEmail: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt: string;
}

const CARRIER_COLORS: Record<string, string> = {
  'CDEK': '#2563eb',
  'DPD': '#f97316',
  'Деловые линии': '#10b981',
  'Почта России': '#ef4444',
  'ПЭК': '#8b5cf6',
  'Самовывоз': '#6b7280',
  'OZON_FBS': '#ec489a',
  'WB_FBS': '#a855f7',
  'Yandex Market': '#f59e0b',
  'AliExpress': '#e11d48',
  'OZON_FBO': '#db2777',
  'WB_FBO': '#c084fc',
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

const getTimeMs = (time: any): number => {
  if (!time) return 0;
  if (typeof time.toDate === 'function') {
    return time.toDate().getTime();
  }
  if (typeof time === 'string') {
    const date = new Date(time);
    return isValid(date) ? date.getTime() : 0;
  }
  if (typeof time === 'number') {
    return time;
  }
  return 0;
};

const getDayOfWeek = (date: any): number => {
  const d = new Date(date);
  return isValid(d) ? d.getDay() : 0;
};

const getHour = (date: any): number => {
  const d = new Date(date);
  return isValid(d) ? d.getHours() : 0;
};

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const getDayName = (dayIndex: number): string => {
  const names = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return names[dayIndex];
};

const safeFormatDate = (date: any, formatStr: string): string => {
  if (!date) return '—';
  const d = new Date(date);
  return isValid(d) ? format(d, formatStr, { locale: ru }) : '—';
};

// ========== КОМПОНЕНТ ==========

export default function AdminDashboard() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [jambs, setJambs] = useState<Jamb[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  
  // --- НОВОЕ: Состояние для просроченных заказов ---
  const [staleOrders, setStaleOrders] = useState<Order[]>([]);
  const [hasShownStaleToast, setHasShownStaleToast] = useState(false);
  // ---------------------------------------------
  
  const currentMonth = getCurrentMonthRange();
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: currentMonth.start,
    end: currentMonth.end,
  });

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/employee');
    }
  }, [authLoading, role, router]);

  // Функция для загрузки данных
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startDate = new Date(dateFilter.start);
      const endDate = new Date(dateFilter.end);
      
      if (!isValid(startDate) || !isValid(endDate)) {
        throw new Error('Неверный формат даты');
      }
      
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      
      // Загружаем заказы
      const ordersQuery = query(
        collection(db, 'orders'),
        where('createdAt', '>=', start.toISOString()),
        where('createdAt', '<=', end.toISOString()),
        orderBy('createdAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
      
      // Загружаем ошибки
      const jambsQuery = query(
        collection(db, 'jambs'),
        where('createdAt', '>=', start.toISOString()),
        where('createdAt', '<=', end.toISOString())
      );
      const jambsSnapshot = await getDocs(jambsQuery);
      const jambsData = jambsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jamb));
      setJambs(jambsData);
      
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Ошибка загрузки данных');
      showToast('Ошибка при загрузке данных', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  // --- НОВОЕ: Функция проверки просроченных заказов ---
  /**
   * Проверяет наличие заказов со статусом 'Ожидает оформления', 
   * которые были созданы более 4 дней (96 часов) назад.
   */
  const checkForStaleOrders = useCallback(async () => {
    // Только для админа
    if (role !== 'admin') return;

    try {
      const fourDaysAgo = new Date();
      fourDaysAgo.setHours(fourDaysAgo.getHours() - 96); // 4 дня = 96 часов
      const fourDaysAgoISO = fourDaysAgo.toISOString();

      const staleQuery = query(
        collection(db, 'orders'),
        where('status', '==', 'Ожидает оформления'),
        where('createdAt', '<=', fourDaysAgoISO)
      );
      
      const snapshot = await getDocs(staleQuery);
      const staleOrdersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      setStaleOrders(staleOrdersList);

      if (staleOrdersList.length > 0 && !hasShownStaleToast) {
        showToast(`⚠️ Внимание! ${staleOrdersList.length} заказ(ов) ожидают оформления более 4 дней.`, 'warning');
        setHasShownStaleToast(true);
      }
      
      if (staleOrdersList.length === 0) {
        setHasShownStaleToast(false);
      }
    } catch (err) {
      console.error('Error checking stale orders:', err);
    }
  }, [role, hasShownStaleToast]);
  // ---------------------------------------------

  // Загружаем данные при изменении фильтра
  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- НОВОЕ: Эффект для проверки просроченных заказов ---
  useEffect(() => {
    if (role === 'admin') {
      checkForStaleOrders(); // Проверить сразу при загрузке
      const intervalId = setInterval(checkForStaleOrders, 3600000); // Каждый час
      return () => clearInterval(intervalId);
    }
  }, [role, checkForStaleOrders]);
  // -----------------------------------------------------

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const newDate = new Date(value);
    if (isValid(newDate)) {
      setDateFilter(prev => ({ ...prev, [type]: value }));
    } else {
      showToast('Введите корректную дату', 'error');
    }
  };

  // Основная статистика
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const ordersToday = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return isValid(orderDate) && orderDate >= today;
    });
    
    let totalWeight = 0, totalVolume = 0, totalAssemblySeconds = 0, assembledCount = 0;
    let totalPaymentSum = 0, totalDeliveryCost = 0, totalProfit = 0;

    orders.forEach(o => {
      if (o.totalWeight) totalWeight += Number(o.totalWeight) || 0;
      if (o.totalVolume) totalVolume += Number(o.totalVolume) || 0;
      
      if (o.time_start && o.time_end) {
        const startMs = getTimeMs(o.time_start);
        const endMs = getTimeMs(o.time_end);
        if (startMs > 0 && endMs > 0 && endMs > startMs) {
          totalAssemblySeconds += (endMs - startMs) / 1000;
          assembledCount++;
        }
      }
      
      if (o.payment_sum) totalPaymentSum += Number(o.payment_sum) || 0;
      if (o.delivery_cost) totalDeliveryCost += Number(o.delivery_cost) || 0;
      if (o.profit) totalProfit += Number(o.profit) || 0;
    });

    const avgAssemblySeconds = assembledCount > 0 ? Math.round(totalAssemblySeconds / assembledCount) : 0;
    const avgMinutes = Math.floor(avgAssemblySeconds / 60);
    const avgSeconds = avgAssemblySeconds % 60;
    const avgTimeFormatted = `${avgMinutes.toString().padStart(2, '0')}:${avgSeconds.toString().padStart(2, '0')}`;

    return {
      todayCount: ordersToday.length,
      avgTime: avgTimeFormatted,
      assembledCount,
      weight: totalWeight.toFixed(1),
      volume: totalVolume.toFixed(4),
      totalCount: orders.length,
      totalPayment: totalPaymentSum,
      totalDelivery: totalDeliveryCost,
      totalProfit: totalProfit
    };
  }, [orders]);

  // Данные по дням недели
  const weeklyData = useMemo(() => {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    orders.forEach(order => {
      const dayOfWeek = getDayOfWeek(order.createdAt);
      if (dayOfWeek >= 0 && dayOfWeek < 7) {
        dayCounts[dayOfWeek]++;
      }
    });
    
    return DAY_NAMES.map((name, index) => ({
      name,
      orders: dayCounts[index],
      fullName: getDayName(index)
    }));
  }, [orders]);

  // Данные по часам для времени сборки
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      orders: 0,
      avgAssemblyTime: 0,
      totalAssemblyTime: 0,
      assembledCount: 0,
      avgAssemblyTimeDisplay: '00:00'
    }));
    
    orders.forEach(order => {
      const hour = getHour(order.createdAt);
      if (hour >= 0 && hour < 24) {
        hours[hour].orders++;
        
        if (order.time_start && order.time_end) {
          const startMs = getTimeMs(order.time_start);
          const endMs = getTimeMs(order.time_end);
          if (startMs > 0 && endMs > 0 && endMs > startMs) {
            const seconds = (endMs - startMs) / 1000;
            hours[hour].totalAssemblyTime += seconds;
            hours[hour].assembledCount++;
          }
        }
      }
    });
    
    hours.forEach(hour => {
      if (hour.assembledCount > 0) {
        const avgSeconds = Math.round(hour.totalAssemblyTime / hour.assembledCount);
        const minutes = Math.floor(avgSeconds / 60);
        const seconds = avgSeconds % 60;
        hour.avgAssemblyTime = avgSeconds;
        hour.avgAssemblyTimeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    });
    
    return hours;
  }, [orders]);

  // KPI ошибок
  const jambData = useMemo(() => {
    const dailyJambs: Record<string, { total: number; bySeverity: Record<string, number> }> = {};
    
    jambs.forEach(jamb => {
      const jambDate = new Date(jamb.createdAt);
      if (!isValid(jambDate)) return;
      
      const date = format(jambDate, 'yyyy-MM-dd');
      if (!dailyJambs[date]) {
        dailyJambs[date] = { total: 0, bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 } };
      }
      dailyJambs[date].total++;
      dailyJambs[date].bySeverity[jamb.severity]++;
    });
    
    const start = new Date(dateFilter.start);
    const end = new Date(dateFilter.end);
    
    if (!isValid(start) || !isValid(end)) return [];
    
    const startDay = startOfDay(start);
    const endDay = endOfDay(end);
    const days = eachDayOfInterval({ start: startDay, end: endDay });
    
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const data = dailyJambs[dateStr] || { total: 0, bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 } };
      const weightedScore = 
        data.bySeverity.Critical * 4 +
        data.bySeverity.High * 3 +
        data.bySeverity.Medium * 2 +
        data.bySeverity.Low * 1;
      
      return {
        date: format(day, 'dd.MM'),
        total: data.total,
        critical: data.bySeverity.Critical,
        high: data.bySeverity.High,
        medium: data.bySeverity.Medium,
        low: data.bySeverity.Low,
        kpiScore: weightedScore
      };
    });
  }, [jambs, dateFilter]);

  // Данные по ТК
  const carrierChartData = useMemo(() => {
    const carrierStats: Record<string, number> = {};
    orders.forEach(order => {
      if (order.carrier && order.status !== 'Отменен') {
        carrierStats[order.carrier] = (carrierStats[order.carrier] || 0) + 1;
      }
    });
    return Object.entries(carrierStats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [orders]);

  // KPI сотрудников
  const employeeKPI = useMemo(() => {
    const employeeStats: Record<string, { 
      orders: number; 
      totalTimeMs: number; 
      assembled: number; 
      jambs: number; 
      jambSeverityScore: number; 
      profit: number;
      lastJambDate?: string;
    }> = {};
    
    orders.forEach(order => {
      const createdBy = order.createdBy || 'Unknown';
      if (!employeeStats[createdBy]) {
        employeeStats[createdBy] = { 
          orders: 0, totalTimeMs: 0, assembled: 0, jambs: 0, jambSeverityScore: 0, profit: 0 
        };
      }
      employeeStats[createdBy].orders++;
      employeeStats[createdBy].profit += order.profit || 0;
      
      if (order.time_start && order.time_end) {
        const startMs = getTimeMs(order.time_start);
        const endMs = getTimeMs(order.time_end);
        if (startMs > 0 && endMs > 0 && endMs > startMs) {
          employeeStats[createdBy].totalTimeMs += (endMs - startMs);
          employeeStats[createdBy].assembled++;
        }
      }
    });
    
    jambs.forEach(jamb => {
      const email = jamb.employeeEmail;
      const severityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      if (employeeStats[email]) {
        employeeStats[email].jambs++;
        employeeStats[email].jambSeverityScore += severityWeight[jamb.severity];
        employeeStats[email].lastJambDate = jamb.createdAt;
      } else {
        employeeStats[email] = {
          orders: 0, totalTimeMs: 0, assembled: 0, jambs: 1,
          jambSeverityScore: severityWeight[jamb.severity],
          profit: 0,
          lastJambDate: jamb.createdAt
        };
      }
    });
    
    const result = Object.entries(employeeStats)
      .map(([email, s]) => {
        const avgTimeSec = s.assembled > 0 ? Math.round(s.totalTimeMs / s.assembled / 1000) : 0;
        const avgTimeMin = Math.floor(avgTimeSec / 60);
        const avgTimeSecRem = avgTimeSec % 60;
        
        const jambPenalty = (s.jambs * 5) + (s.jambSeverityScore * 2);
        
        let kpiScore = (s.orders * 10) - jambPenalty - (avgTimeSec / 60) + (s.profit / 5000);
        kpiScore = Math.max(0, Math.min(100, kpiScore));
        
        let efficiencyLevel = 'Низкая';
        if (kpiScore >= 80) efficiencyLevel = 'Высокая';
        else if (kpiScore >= 60) efficiencyLevel = 'Средняя';
        else if (kpiScore >= 40) efficiencyLevel = 'Ниже среднего';
        
        return {
          name: email.split('@')[0],
          email,
          orders: s.orders,
          avgTime: avgTimeSec,
          avgTimeDisplay: `${avgTimeMin.toString().padStart(2, '0')}:${avgTimeSecRem.toString().padStart(2, '0')}`,
          jambs: s.jambs,
          jambScore: s.jambSeverityScore,
          profit: s.profit,
          kpiScore: Math.round(kpiScore),
          efficiency: efficiencyLevel,
          lastJambDate: s.lastJambDate ? safeFormatDate(s.lastJambDate, 'dd.MM.yyyy HH:mm') : null
        };
      })
      .sort((a, b) => b.kpiScore - a.kpiScore);
    
    return result;
  }, [orders, jambs]);

  const totalJambs = jambs.length;
  const criticalJambs = jambs.filter(j => j.severity === 'Critical').length;
  const highJambs = jambs.filter(j => j.severity === 'High').length;

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData().finally(() => setIsRefreshing(false));
  };

  const handleSetCurrentMonth = () => {
    const month = getCurrentMonthRange();
    setDateFilter({ start: month.start, end: month.end });
    showToast('Установлен текущий месяц', 'info');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-8">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Ошибка загрузки данных</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button 
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Повторить попытку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <LayoutDashboard className="w-8 h-8 text-blue-600" />
                Панель управления
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Статистика склада за {safeFormatDate(dateFilter.start, 'MMMM yyyy')}
              </p>
              <p className="text-xs text-slate-400">
                {orders.length} заказов, {jambs.length} ошибок • Обновлено: {format(lastUpdate, 'HH:mm:ss')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={dateFilter.start} 
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="text-sm border-none focus:ring-0 outline-none bg-transparent dark:text-white cursor-pointer"
              />
              <span className="text-slate-400">—</span>
              <input 
                type="date" 
                value={dateFilter.end} 
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="text-sm border-none focus:ring-0 outline-none bg-transparent dark:text-white cursor-pointer"
              />
            </div>
            <button 
              onClick={handleSetCurrentMonth} 
              className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Текущий месяц
            </button>
            <button 
              onClick={handleRefresh} 
              disabled={isRefreshing} 
              className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* --- НОВЫЙ UI БЛОК: Просроченные заказы --- */}
        {role === 'admin' && staleOrders.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-amber-800 dark:text-amber-300">
                Требуют внимания: Заказы, ожидающие оформления
              </h2>
              <span className="ml-auto text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-3 py-1 rounded-full">
                {staleOrders.length} заказ(ов) старше 4 дней
              </span>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {staleOrders.map(order => (
                <div 
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-100 dark:border-amber-800/50 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        Заказ №{order.orderNumber || 'Без номера'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Создан: {order.createdAt ? format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                    className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    Открыть карточку →
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {/* ----------------------------------------- */}

        {orders.length === 0 && jambs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Нет данных за выбранный период</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              За период с {safeFormatDate(dateFilter.start, 'dd.MM.yyyy')} по {safeFormatDate(dateFilter.end, 'dd.MM.yyyy')} нет заказов или ошибок.
            </p>
            <button 
              onClick={handleSetCurrentMonth}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Показать текущий месяц
            </button>
          </div>
        ) : (
          <>
            {/* Основные метрики */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Заказов за период" value={orders.length} icon={<Package className="w-6 h-6" />} color="blue" />
              <StatCard title="Ср. время сборки" value={stats.avgTime} icon={<Clock className="w-6 h-6" />} color="emerald" />
              <StatCard title="Общая прибыль" value={`${stats.totalProfit.toLocaleString()} ₽`} icon={<TrendingUp className="w-6 h-6" />} color="green" />
              <StatCard title="Ошибки (JAMBS)" value={jambs.length} icon={<AlertTriangle className="w-6 h-6" />} color="red" />
            </div>

            {/* Графики: Заказы по дням недели и Время сборки по часам */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ChartCard title="Заказы по дням недели" icon={<BarChart3 className="w-5 h-5 text-blue-600" />}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      formatter={(value: any) => [`${value} заказов`, '']}
                    />
                    <Bar dataKey="orders" fill="#2563eb" radius={[8, 8, 0, 0]} barSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Среднее время сборки по часам" icon={<Clock className="w-5 h-5 text-emerald-600" />}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourlyData.filter(h => h.assembledCount > 0)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} interval={2} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip formatter={(value: any, name: any, props: any) => [props.payload.avgAssemblyTimeDisplay, 'Среднее время']} />
                    <Line type="monotone" dataKey="avgAssemblyTime" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="text-center text-xs text-slate-400 mt-2">
                  Показаны часы с выполненными заказами
                </div>
              </ChartCard>
            </div>

            {/* KPI ошибок */}
            <ChartCard title="KPI ошибок (JAMBS)" icon={<AlertTriangle className="w-5 h-5 text-red-500" />}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={jambData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar yAxisId="left" dataKey="critical" name="Critical" fill="#ef4444" stackId="a" />
                  <Bar yAxisId="left" dataKey="high" name="High" fill="#f97316" stackId="a" />
                  <Bar yAxisId="left" dataKey="medium" name="Medium" fill="#eab308" stackId="a" />
                  <Bar yAxisId="left" dataKey="low" name="Low" fill="#22c55e" stackId="a" />
                  <Line yAxisId="right" type="monotone" dataKey="kpiScore" name="KPI Score" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Эффективность сотрудников (KPI) */}
            <ChartCard title="Эффективность сотрудников (KPI)" icon={<Users className="w-5 h-5 text-emerald-600" />}>
              {employeeKPI.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Нет данных о сотрудниках
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {employeeKPI.map((employee, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {employee.name}
                          </span>
                          <span className="font-bold" style={{
                            color: employee.kpiScore >= 80 ? '#10b981' : employee.kpiScore >= 60 ? '#eab308' : '#ef4444'
                          }}>
                            {employee.kpiScore}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                          <div 
                            className="h-3 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${employee.kpiScore}%`,
                              backgroundColor: employee.kpiScore >= 80 ? '#10b981' : employee.kpiScore >= 60 ? '#eab308' : '#ef4444'
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>📦 {employee.orders} заказов</span>
                          <span>⏱️ {employee.avgTimeDisplay}</span>
                          <span>⚠️ {employee.jambs} ошибок</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-center">
                      <div className="text-xs text-slate-500">Лидер</div>
                      <div className="font-bold text-slate-900 dark:text-white text-lg">
                        {employeeKPI[0]?.name || '—'}
                      </div>
                      <div className="text-xs text-emerald-600 font-semibold">
                        {employeeKPI[0]?.kpiScore}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">Средний KPI</div>
                      <div className="font-bold text-slate-900 dark:text-white text-lg">
                        {employeeKPI.length ? Math.round(employeeKPI.reduce((a, b) => a + b.kpiScore, 0) / employeeKPI.length) : '—'}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">Всего сотрудников</div>
                      <div className="font-bold text-slate-900 dark:text-white text-lg">
                        {employeeKPI.length}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </ChartCard>

            {/* Динамика заказов и распределение по ТК */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ChartCard title="Динамика заказов" icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} interval={3} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} fill="#10b981" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Распределение по ТК" icon={<Truck className="w-5 h-5 text-blue-600" />}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={carrierChartData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={100} dataKey="value">
                      {carrierChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CARRIER_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Компонент карточки статистики
function StatCard({ title, value, icon, color, subtitle }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}>{icon}</div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
    </motion.div>
  );
}

// Компонент карточки графика
function ChartCard({ title, icon, subtitle, children }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">{icon}{title}</h2>
        {subtitle && <span className="text-xs text-slate-400 font-bold">{subtitle}</span>}
      </div>
      <div className="h-[300px] w-full">{children}</div>
    </div>
  );
}