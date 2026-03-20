'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  Timestamp,
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
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'motion/react';

interface Order {
  id: string;
  status: string;
  createdAt: string;
  time_start?: string;
  time_end?: string;
  totalWeight?: number;
  totalVolume?: number;
  createdBy: string;
}

export default function AdminDashboard() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/employee');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (role !== 'admin') return;

    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
      setLoading(false);
    }, (error) => {
      console.error('Firestore Error in Admin Dashboard:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role]);

  // Stats Calculations
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const ordersToday = orders.filter(o => new Date(o.createdAt) >= today);
    
    let totalWeight = 0;
    let totalVolume = 0;
    let totalAssemblyTime = 0;
    let assembledCount = 0;

    orders.forEach(o => {
      if (o.totalWeight) totalWeight += Number(o.totalWeight) || 0;
      if (o.totalVolume) totalVolume += Number(o.totalVolume) || 0;
      
      if (o.time_start && o.time_end) {
        const start = new Date(o.time_start).getTime();
        const end = new Date(o.time_end).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          totalAssemblyTime += (end - start);
          assembledCount++;
        }
      }
    });

    const avgAssemblyTime = assembledCount > 0 
      ? Math.round(totalAssemblyTime / assembledCount / 60000) // in minutes
      : 0;

    return {
      todayCount: ordersToday.length,
      avgTime: avgAssemblyTime,
      weight: totalWeight.toFixed(1),
      volume: totalVolume.toFixed(2),
      totalCount: orders.length
    };
  }, [orders]);

  // Chart Data: Orders per day (last 7 days)
  const lineChartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).reverse();

    return last7Days.map(date => {
      const count = orders.filter(o => {
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === date.getTime();
      }).length;

      return {
        name: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
        orders: count
      };
    });
  }, [orders]);

  // Chart Data: Employee Efficiency
  const barChartData = useMemo(() => {
    const employeeStats: Record<string, { count: number; totalTime: number; assembled: number }> = {};
    
    orders.forEach(o => {
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

    return Object.entries(employeeStats).map(([email, s]) => ({
      name: email.split('@')[0],
      orders: s.count,
      avgTime: s.assembled > 0 ? Math.round(s.totalTime / s.assembled / 60000) : 0
    })).slice(0, 5); // Top 5
  }, [orders]);

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
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 shadow-sm">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Заказов сегодня" 
            value={stats.todayCount} 
            icon={<Package className="w-6 h-6" />} 
            color="blue"
            trend="+12%"
            trendUp={true}
          />
          <StatCard 
            title="Ср. время сборки" 
            value={`${stats.avgTime} мин`} 
            icon={<Clock className="w-6 h-6" />} 
            color="emerald"
            trend="-2 мин"
            trendUp={false}
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

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Line Chart: Orders Trend */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Динамика заказов
              </h2>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">За 7 дней</span>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
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
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart: Employee Performance */}
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
                <BarChart data={barChartData}>
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
                      border: '1px solid #e2e8f0'
                    }}
                  />
                  <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                  <Bar dataKey="orders" name="Заказов" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="avgTime" name="Ср. время (мин)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, trend, trendUp }: any) {
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
          {trend && (
            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
              {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend}
            </span>
          )}
        </div>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
        {React.cloneElement(icon, { size: 100 })}
      </div>
    </motion.div>
  );
}
