'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  Timestamp
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
  Cell,
  Legend,
  PieChart,
  Pie,
  AreaChart,
  Area
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
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Order {
  id: string;
  status: string;
  createdAt: string;
  time_start?: string;
  time_end?: string;
  totalWeight?: number;
  totalVolume?: number;
  createdBy: string;
  payment_sum?: number;
  delivery_cost?: number;
  profit?: number;
}

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

  // Фильтрация заказов по дате
  const filteredOrders = useMemo(() => {
    if (!dateFilter.start || !dateFilter.end) return orders;
    
    const start = startOfDay(new Date(dateFilter.start));
    const end = endOfDay(new Date(dateFilter.end));
    
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return isWithinInterval(orderDate, { start, end });
    });
  }, [orders, dateFilter]);

  // Stats Calculations с правильными расчетами
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
      // Вес и объем
      if (o.totalWeight) totalWeight += Number(o.totalWeight) || 0;
      if (o.totalVolume) totalVolume += Number(o.totalVolume) || 0;
      
      // Время сборки (в секундах)
      if (o.time_start && o.time_end) {
        const start = new Date(o.time_start).getTime();
        const end = new Date(o.time_end).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          const seconds = (end - start) / 1000;
          totalAssemblySeconds += seconds;
          assembledCount++;
        }
      }
      
      // Финансы
      if (o.payment_sum) totalPaymentSum += Number(o.payment_sum) || 0;
      if (o.delivery_cost) totalDeliveryCost += Number(o.delivery_cost) || 0;
      if (o.profit) totalProfit += Number(o.profit) || 0;
    });

    const avgAssemblySeconds = assembledCount > 0 
      ? Math.round(totalAssemblySeconds / assembledCount)
      : 0;
    const avgAssemblyMinutes = Math.floor(avgAssemblySeconds / 60);
    const avgAssemblySecondsRemainder = avgAssemblySeconds % 60;
    const avgAssemblyFormatted = `${avgAssemblyMinutes}:${avgAssemblySecondsRemainder.toString().padStart(2, '0')}`;

    return {
      todayCount: ordersToday.length,
      avgTime: avgAssemblyFormatted,
      avgTimeSeconds: avgAssemblySeconds,
      weight: totalWeight.toFixed(1),
      volume: totalVolume.toFixed(4),
      totalCount: filteredOrders.length,
      totalPayment: totalPaymentSum,
      totalDelivery: totalDeliveryCost,
      totalProfit: totalProfit
    };
  }, [filteredOrders]);

  // График заказов по дням недели (за выбранный период)
  const weeklyChartData = useMemo(() => {
    const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const dayOfWeek = orderDate.getDay();
      // Преобразуем день недели (0=ВС, 1=ПН...) в индекс массива (0=ПН)
      let index = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      dayCounts[index]++;
    });
    
    return dayNames.map((name, i) => ({
      name,
      заказы: dayCounts[i]
    }));
  }, [filteredOrders]);

  // График динамики заказов по дням (за выбранный период)
  const dailyChartData = useMemo(() => {
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
        fullDate: format(day, 'yyyy-MM-dd')
      };
    });
  }, [filteredOrders, dateFilter]);

  // Топ сотрудников по количеству заказов
  const topEmployees = useMemo(() => {
    const employeeStats: Record<string, { count: number; totalTime: number; assembled: number }> = {};
    
    filteredOrders.forEach(o => {
      const createdBy = o.createdBy || 'Unknown';
      if (!employeeStats[createdBy]) {
        employeeStats[createdBy] = { count: 0, totalTime: 0, assembled: 0 };
      }
      employeeStats[createdBy].count++;
      
      if (o.time_start && o.time_end) {
        const start = new Date(o.time_start).getTime();
        const end = new Date(o.time_end).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          employeeStats[createdBy].totalTime += (end - start);
          employeeStats[createdBy].assembled++;
        }
      }
    });

    return Object.entries(employeeStats)
      .map(([email, s]) => ({
        name: email.split('@')[0],
        orders: s.count,
        avgTime: s.assembled > 0 ? Math.round(s.totalTime / s.assembled / 60000) : 0
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  }, [filteredOrders]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <LayoutDashboard className="w-8 h-8 text-blue-600" />
                Панель управления
              </h1>
              <p className="text-slate-500">Статистика склада в реальном времени</p>
            </div>
          </div>
          
          {/* Фильтр по дате */}
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="text-sm border-none focus:ring-0 outline-none"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="text-sm border-none focus:ring-0 outline-none"
            />
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Заказов за период" 
            value={stats.totalCount} 
            icon={<Package className="w-6 h-6" />} 
            color="blue"
            subtitle={`${stats.todayCount} сегодня`}
          />
          <StatCard 
            title="Ср. время сборки" 
            value={stats.avgTime} 
            icon={<Clock className="w-6 h-6" />} 
            color="emerald"
            subtitle={`${stats.avgTimeSeconds} сек`}
          />
          <StatCard 
            title="Общий вес" 
            value={`${stats.weight} кг`} 
            icon={<Weight className="w-6 h-6" />} 
            color="orange"
          />
          <StatCard 
            title="Общий объем" 
            value={`${stats.volume} м³`} 
            icon={<Layers className="w-6 h-6" />} 
            color="violet"
          />
        </div>

        {/* Финансовые показатели */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard 
            title="Сумма оплат" 
            value={`${stats.totalPayment.toLocaleString()} ₽`} 
            icon={<Package className="w-6 h-6" />} 
            color="blue"
          />
          <StatCard 
            title="Стоимость доставки" 
            value={`${stats.totalDelivery.toLocaleString()} ₽`} 
            icon={<Truck className="w-6 h-6" />} 
            color="orange"
          />
          <StatCard 
            title="Чистая прибыль" 
            value={`${stats.totalProfit.toLocaleString()} ₽`} 
            icon={<TrendingUp className="w-6 h-6" />} 
            color="emerald"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* График заказов по дням недели */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Заказы по дням недели
              </h2>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {format(new Date(dateFilter.start), 'dd.MM')} - {format(new Date(dateFilter.end), 'dd.MM')}
              </span>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="заказы" 
                    fill="#2563eb" 
                    radius={[8, 8, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* График динамики заказов по дням */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Динамика заказов
              </h2>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                По дням
              </span>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    labelFormatter={(label) => `Дата: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fill="url(#colorGradient)" 
                    fillOpacity={0.3}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Employee Performance */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Эффективность сотрудников
            </h2>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Топ 5</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEmployees}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0'
                  }}
                />
                <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                <Bar yAxisId="left" dataKey="orders" name="Заказов" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar yAxisId="right" dataKey="avgTime" name="Ср. время (мин)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border ${colors[color]}`}>
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-3">
          <h3 className="text-2xl font-black text-slate-900">{value}</h3>
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
        {React.cloneElement(icon, { size: 100 })}
      </div>
    </motion.div>
  );
}

function Truck({ className, size }: any) {
  return <Package className={className} />;
}