// app/admin/dashboard/page.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  getDocs,
  orderBy,
  where
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
  Filter,
  Truck,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfDay, endOfDay, eachDayOfInterval, isWithinInterval } from 'date-fns';
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

const getHour = (date: any): number => {
  const d = new Date(date);
  return d.getHours();
};

export default function AdminDashboard() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [jambs, setJambs] = useState<Jamb[]>([]);
  const [loading, setLoading] = useState(true);
  
  const currentMonth = getCurrentMonthRange();
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: currentMonth.start,
    end: currentMonth.end,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/employee');
    }
  }, [authLoading, role, router]);

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const start = startOfDay(new Date(dateFilter.start));
      const end = endOfDay(new Date(dateFilter.end));
      
      const ordersQuery = query(
        collection(db, 'orders'),
        where('createdAt', '>=', start.toISOString()),
        where('createdAt', '<=', end.toISOString()),
        orderBy('createdAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
      
      const jambsQuery = query(
        collection(db, 'jambs'),
        where('createdAt', '>=', start.toISOString()),
        where('createdAt', '<=', end.toISOString())
      );
      const jambsSnapshot = await getDocs(jambsQuery);
      const jambsData = jambsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jamb));
      setJambs(jambsData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Ошибка при загрузке данных', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const ordersToday = orders.filter(o => new Date(o.createdAt) >= today);
    
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

  const jambData = useMemo(() => {
    const dailyJambs: Record<string, { total: number; bySeverity: Record<string, number> }> = {};
    
    jambs.forEach(jamb => {
      const date = format(new Date(jamb.createdAt), 'yyyy-MM-dd');
      if (!dailyJambs[date]) {
        dailyJambs[date] = { total: 0, bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 } };
      }
      dailyJambs[date].total++;
      dailyJambs[date].bySeverity[jamb.severity]++;
    });
    
    const start = startOfDay(new Date(dateFilter.start));
    const end = endOfDay(new Date(dateFilter.end));
    const days = eachDayOfInterval({ start, end });
    
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

  const carrierChartData = useMemo(() => {
    const carrierStats: Record<string, number> = {};
    orders.forEach(order => {
      if (order.carrier && order.status !== 'Отменен') {
        carrierStats[order.carrier] = (carrierStats[order.carrier] || 0) + 1;
      }
    });
    return Object.entries(carrierStats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [orders]);

  const employeeKPI = useMemo(() => {
    const employeeStats: Record<string, { orders: number; totalTimeMs: number; assembled: number; jambs: number; jambSeverityScore: number; profit: number }> = {};
    
    orders.forEach(order => {
      const createdBy = order.createdBy || 'Unknown';
      if (!employeeStats[createdBy]) {
        employeeStats[createdBy] = { orders: 0, totalTimeMs: 0, assembled: 0, jambs: 0, jambSeverityScore: 0, profit: 0 };
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
      } else {
        employeeStats[email] = {
          orders: 0, totalTimeMs: 0, assembled: 0, jambs: 1,
          jambSeverityScore: severityWeight[jamb.severity],
          profit: 0
        };
      }
    });
    
    return Object.entries(employeeStats).map(([email, s]) => {
      const avgTimeSec = s.assembled > 0 ? Math.round(s.totalTimeMs / s.assembled / 1000) : 0;
      const avgTimeMin = Math.floor(avgTimeSec / 60);
      const avgTimeSecRem = avgTimeSec % 60;
      const kpiScore = Math.max(0, Math.min(100,
        (s.orders * 10) - (s.jambs * 5) - (s.jambSeverityScore * 2) - (avgTimeSec / 60) + (s.profit / 5000)
      ));
      
      return {
        name: email.split('@')[0],
        orders: s.orders,
        avgTime: avgTimeSec,
        avgTimeDisplay: `${avgTimeMin.toString().padStart(2, '0')}:${avgTimeSecRem.toString().padStart(2, '0')}`,
        jambs: s.jambs,
        profit: s.profit,
        kpiScore: Math.round(kpiScore)
      };
    }).sort((a, b) => b.kpiScore - a.kpiScore);
  }, [orders, jambs]);

  const totalJambs = jambs.length;
  const criticalJambs = jambs.filter(j => j.severity === 'Critical').length;
  const highJambs = jambs.filter(j => j.severity === 'High').length;

  if (authLoading || (loading && orders.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
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
                Статистика склада за {format(new Date(dateFilter.start), 'MMMM yyyy', { locale: ru })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })} className="text-sm border-none focus:ring-0 outline-none bg-transparent dark:text-white" />
              <span className="text-slate-400">—</span>
              <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })} className="text-sm border-none focus:ring-0 outline-none bg-transparent dark:text-white" />
            </div>
            <button onClick={() => { setDateFilter(getCurrentMonthRange()); showToast('Установлен текущий месяц', 'info'); }} className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors">
              Текущий месяц
            </button>
            <button onClick={fetchData} disabled={isRefreshing} className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <RefreshCw className={`w-5 h-5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Заказов за период" value={stats.totalCount} icon={<Package className="w-6 h-6" />} color="blue" subtitle={`${stats.todayCount} сегодня`} />
          <StatCard title="Ср. время сборки" value={stats.avgTime} icon={<Clock className="w-6 h-6" />} color="emerald" subtitle={`${stats.assembledCount} заказов`} />
          <StatCard title="Общая прибыль" value={`${stats.totalProfit.toLocaleString()} ₽`} icon={<TrendingUp className="w-6 h-6" />} color="green" />
          <StatCard title="Ошибки (JAMBS)" value={totalJambs} icon={<AlertTriangle className="w-6 h-6" />} color="red" subtitle={`Critical: ${criticalJambs}, High: ${highJambs}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartCard title="Заказы по часам дня" icon={<Activity className="w-5 h-5 text-blue-600" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} interval={3} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="orders" fill="#2563eb" radius={[4, 4, 0, 0]} />
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
          </ChartCard>
        </div>

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

        <ChartCard title="Эффективность сотрудников (KPI)" icon={<Users className="w-5 h-5 text-emerald-600" />}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={employeeKPI} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={70} />
              <Tooltip formatter={(value: any, name: string, props: any) => {
                const data = props.payload;
                return [`KPI: ${data.kpiScore}% | Заказов: ${data.orders} | Время: ${data.avgTimeDisplay} | Ошибок: ${data.jambs}`, ''];
              }} />
              <Bar dataKey="kpiScore" name="KPI %" fill="#10b981" radius={[0, 8, 8, 0]}>
                {employeeKPI.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.kpiScore >= 80 ? '#10b981' : entry.kpiScore >= 60 ? '#eab308' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

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
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
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