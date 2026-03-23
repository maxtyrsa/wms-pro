'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  Legend
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
  Filter,
  Truck,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Order {
  id: string;
  status: string;
  createdAt: string;
  time_start?: any;
  time_end?: any;
  totalWeight?: number;
  totalVolume?: number;
  createdBy: string;
  payment_sum?: number;
  delivery_cost?: number;
  profit?: number;
  carrier: string;
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

export default function AdminDashboard() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/employee');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (role !== 'admin') return;

    const fetchOrders = async () => {
      try {
        const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(ordersQuery);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(data);
      } catch (error) {
        console.error('Firestore Error in Admin Dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [role]);

  const filteredOrders = useMemo(() => {
    if (!dateFilter.start || !dateFilter.end) return orders;
    
    const start = startOfDay(new Date(dateFilter.start));
    const end = endOfDay(new Date(dateFilter.end));
    
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return isWithinInterval(orderDate, { start, end });
    });
  }, [orders, dateFilter]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const ordersToday = filteredOrders.filter(o => new Date(o.createdAt) >= today);
    
    let totalWeight = 0;
    let totalVolume = 0;
    let totalAssemblySeconds = 0;
    let assembledCount = 0;
    let totalPaymentSum = 0;
    let totalDeliveryCost = 0;
    let totalProfit = 0;

    filteredOrders.forEach(o => {
      if (o.totalWeight) totalWeight += Number(o.totalWeight) || 0;
      if (o.totalVolume) totalVolume += Number(o.totalVolume) || 0;
      
      if (o.time_start && o.time_end) {
        const startMs = getTimeMs(o.time_start);
        const endMs = getTimeMs(o.time_end);
        if (startMs > 0 && endMs > 0 && endMs > startMs) {
          const seconds = (endMs - startMs) / 1000;
          totalAssemblySeconds += seconds;
          assembledCount++;
        }
      }
      
      if (o.payment_sum) totalPaymentSum += Number(o.payment_sum) || 0;
      if (o.delivery_cost) totalDeliveryCost += Number(o.delivery_cost) || 0;
      if (o.profit) totalProfit += Number(o.profit) || 0;
    });

    const avgAssemblySeconds = assembledCount > 0 ? Math.round(totalAssemblySeconds / assembledCount) : 0;
    const avgAssemblyMinutes = Math.floor(avgAssemblySeconds / 60);
    const avgAssemblySecondsRemainder = avgAssemblySeconds % 60;
    const avgAssemblyFormatted = `${avgAssemblyMinutes.toString().padStart(2, '0')}:${avgAssemblySecondsRemainder.toString().padStart(2, '0')}`;

    return {
      todayCount: ordersToday.length,
      avgTime: avgAssemblyFormatted,
      avgTimeSeconds: avgAssemblySeconds,
      assembledCount: assembledCount,
      weight: totalWeight.toFixed(1),
      volume: totalVolume.toFixed(4),
      totalCount: filteredOrders.length,
      totalPayment: totalPaymentSum,
      totalDelivery: totalDeliveryCost,
      totalProfit: totalProfit
    };
  }, [filteredOrders]);

  const weeklyChartData = useMemo(() => {
    const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const dayOfWeek = orderDate.getDay();
      let index = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      dayCounts[index]++;
    });
    
    return dayNames.map((name, i) => ({ name, заказы: dayCounts[i] }));
  }, [filteredOrders]);

  const dailyOrdersData = useMemo(() => {
    const start = startOfDay(new Date(dateFilter.start));
    const end = endOfDay(new Date(dateFilter.end));
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const count = filteredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= dayStart && orderDate <= dayEnd;
      }).length;
      return { 
        date: format(day, 'dd.MM'), 
        orders: count,
        fullDate: day
      };
    });
  }, [filteredOrders, dateFilter]);

  const dailyProfitData = useMemo(() => {
    const start = startOfDay(new Date(dateFilter.start));
    const end = endOfDay(new Date(dateFilter.end));
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const totalProfit = filteredOrders
        .filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= dayStart && orderDate <= dayEnd;
        })
        .reduce((sum, order) => sum + (order.profit || 0), 0);
      
      return { 
        date: format(day, 'dd.MM'), 
        profit: totalProfit,
        fullDate: day
      };
    });
  }, [filteredOrders, dateFilter]);

  const carrierChartData = useMemo(() => {
    const carrierStats: Record<string, number> = {};
    
    filteredOrders.forEach(order => {
      if (order.carrier && order.status !== 'Отменен') {
        carrierStats[order.carrier] = (carrierStats[order.carrier] || 0) + 1;
      }
    });
    
    return Object.entries(carrierStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredOrders]);

  const topEmployees = useMemo(() => {
    const employeeStats: Record<string, { count: number; totalTimeMs: number; assembled: number }> = {};
    
    filteredOrders.forEach(o => {
      const createdBy = o.createdBy || 'Unknown';
      if (!employeeStats[createdBy]) {
        employeeStats[createdBy] = { count: 0, totalTimeMs: 0, assembled: 0 };
      }
      employeeStats[createdBy].count++;
      
      if (o.time_start && o.time_end) {
        const startMs = getTimeMs(o.time_start);
        const endMs = getTimeMs(o.time_end);
        if (startMs > 0 && endMs > 0 && endMs > startMs) {
          employeeStats[createdBy].totalTimeMs += (endMs - startMs);
          employeeStats[createdBy].assembled++;
        }
      }
    });

    return Object.entries(employeeStats)
      .map(([email, s]) => ({
        name: email.split('@')[0],
        orders: s.count,
        avgTime: s.assembled > 0 ? Math.round(s.totalTimeMs / s.assembled / 60000) : 0
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  }, [filteredOrders]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <LayoutDashboard className="w-8 h-8 text-blue-600" />
                Панель управления
              </h1>
              <p className="text-slate-500 dark:text-slate-400">Статистика склада в реальном времени</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="text-sm border-none focus:ring-0 outline-none bg-transparent dark:text-white"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="text-sm border-none focus:ring-0 outline-none bg-transparent dark:text-white"
            />
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Заказов за период" value={stats.totalCount} icon={<Package className="w-6 h-6" />} color="blue" subtitle={`${stats.todayCount} сегодня`} />
          <StatCard title="Ср. время сборки" value={stats.avgTime} icon={<Clock className="w-6 h-6" />} color="emerald" subtitle={`${stats.assembledCount} заказов с временем`} />
          <StatCard title="Общий вес" value={`${stats.weight} кг`} icon={<Weight className="w-6 h-6" />} color="orange" />
          <StatCard title="Общий объем" value={`${stats.volume} м³`} icon={<Layers className="w-6 h-6" />} color="violet" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard title="Сумма оплат" value={`${stats.totalPayment.toLocaleString()} ₽`} icon={<Package className="w-6 h-6" />} color="blue" />
          <StatCard title="Стоимость доставки" value={`${stats.totalDelivery.toLocaleString()} ₽`} icon={<Truck className="w-6 h-6" />} color="orange" />
          <StatCard title="Чистая прибыль" value={`${stats.totalProfit.toLocaleString()} ₽`} icon={<TrendingUp className="w-6 h-6" />} color="emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Заказы по дням недели
              </h2>
              <span className="text-xs text-slate-400 font-bold uppercase">
                {format(new Date(dateFilter.start), 'dd.MM')} - {format(new Date(dateFilter.end), 'dd.MM')}
              </span>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="заказы" fill="#2563eb" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Заказы по ТК
              </h2>
              <span className="text-xs text-slate-400 font-bold uppercase">
                Всего: {stats.totalCount}
              </span>
            </div>
            <div className="h-[300px] w-full">
              {carrierChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={carrierChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const pct = percent || 0;
                        return `${name} (${(pct * 100).toFixed(0)}%)`;
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {carrierChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CARRIER_COLORS[entry.name] || `#${Math.floor(Math.random()*16777215).toString(16)}`} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => {
                        const numValue = typeof value === 'number' ? value : 0;
                        return [`${numValue} заказов`, 'Количество'];
                      }} 
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Нет данных за выбранный период
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Динамика заказов
              </h2>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyOrdersData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} fill="#10b981" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Динамика прибыли (₽)
              </h2>
              <span className="text-xs text-slate-400 font-bold uppercase">
                Всего: {stats.totalProfit.toLocaleString()} ₽
              </span>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyProfitData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: any) => {
                      const numValue = typeof value === 'number' ? value : 0;
                      return [`${numValue.toLocaleString()} ₽`, 'Прибыль'];
                    }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Эффективность сотрудников
            </h2>
            <span className="text-xs text-slate-400 font-bold uppercase">Топ 5</span>
          </div>
          <div className="h-[300px] w-full">
            {topEmployees.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEmployees}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                  <Bar yAxisId="left" dataKey="orders" name="Заказов" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar yAxisId="right" dataKey="avgTime" name="Ср. время (мин)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Нет данных о сотрудниках
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border-blue-100 dark:border-blue-800',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400 border-orange-100 dark:border-orange-800',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400 border-violet-100 dark:border-violet-800'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border ${colors[color]}`}>
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-3">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
        </div>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
        {React.cloneElement(icon, { size: 100 })}
      </div>
    </motion.div>
  );
}