'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { startOfDay, endOfDay, differenceInSeconds, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LogOut, Package, Users, LayoutDashboard, ShieldAlert, FileSpreadsheet, ClipboardList, Clock, Truck, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DashboardPage() {
  const { user, role, loading, logout } = useAuth();
  const router = useRouter();
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    // Today's orders for stats and list
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();
    const qToday = query(
      collection(db, 'orders'), 
      where('createdAt', '>=', todayStart),
      where('createdAt', '<=', todayEnd),
      orderBy('createdAt', 'desc')
    );
    const unsubToday = onSnapshot(qToday, (snapshot) => {
      setTodayOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setOrdersLoading(false);
    }, (error) => {
      console.error('Firestore Error in Dashboard:', error);
      setOrdersLoading(false);
    });

    return () => {
      unsubToday();
    };
  }, [user]);

  useEffect(() => {
    if (!user || role !== 'admin') return;
    const qUsers = query(collection(db, 'users'), where('role', '==', 'employee'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setEmployeeCount(snapshot.docs.length);
    });
    return () => unsubUsers();
  }, [user, role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;

  // Employee stats calculations
  const myTodayOrders = todayOrders.filter(o => o.createdBy === user?.email);
  const myAssembledOrders = myTodayOrders.filter(o => 
    o.status === 'Ожидает оформления' || o.status === 'Оформлен'
  );

  let totalSeconds = 0;
  let assembledCountWithTime = 0;
  myTodayOrders.forEach(o => {
    if (o.time_start && o.time_end) {
      const start = typeof o.time_start.toDate === 'function' ? o.time_start.toDate() : new Date(o.time_start);
      const end = typeof o.time_end.toDate === 'function' ? o.time_end.toDate() : new Date(o.time_end);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        totalSeconds += differenceInSeconds(end, start);
        assembledCountWithTime++;
      }
    }
  });
  const avgSeconds = assembledCountWithTime > 0 ? Math.floor(totalSeconds / assembledCountWithTime) : 0;
  const avgMins = Math.floor(avgSeconds / 60);
  const avgSecsRemainder = avgSeconds % 60;
  const avgTimeFormatted = `${avgMins.toString().padStart(2, '0')}:${avgSecsRemainder.toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Package className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900">WMS Pro</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user.displayName}</p>
            <p className="text-xs text-slate-500 capitalize">{role}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Выйти"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Панель управления</h1>
            <p className="text-slate-500">Добро пожаловать в систему управления складом.</p>
          </div>
          <Link 
            href="/employee/add_order"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            <span>Новый заказ</span>
          </Link>
        </header>

        {role === 'admin' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <StatCard icon={<Users />} label="Сотрудники" value={employeeCount.toString()} color="emerald" />
            <StatCard icon={<Package />} label="Заказы сегодня" value={todayOrders.length.toString()} color="blue" />
          </div>
        ) : (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Моя работа сегодня</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard icon={<Package />} label="Собрано заказов" value={myAssembledOrders.length.toString()} color="blue" />
              <StatCard icon={<Clock />} label="Среднее время" value={avgTimeFormatted} color="amber" />
            </div>
          </div>
        )}

        {/* Admin Navigation Cards */}
        {role === 'admin' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <NavCard 
              href="/admin/dashboard"
              icon={<LayoutDashboard />}
              title="Админ-панель"
              description="Статистика и графики"
              color="blue"
            />
            <NavCard 
              href="/admin/orders"
              icon={<ClipboardList />}
              title="Заказы"
              description="Управление заказами"
              color="indigo"
            />
            <NavCard 
              href="/admin/users"
              icon={<Users />}
              title="Пользователи"
              description="Управление доступом"
              color="purple"
            />
            <NavCard 
              href="/admin/jambs"
              icon={<ShieldAlert />}
              title="Модуль JAMBS"
              description="Ошибки сотрудников"
              color="red"
            />
            <NavCard 
              href="/admin/reports"
              icon={<FileSpreadsheet />}
              title="Отчеты"
              description="Экспорт в Excel"
              color="emerald"
            />
            <NavCard 
              href="/admin/pickup_orders"
              icon={<Truck />}
              title="Самовывоз"
              description="Управление выдачей"
              color="orange"
            />
          </div>
        )}

        {/* Employee Navigation Cards */}
        {role === 'employee' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <NavCard 
              href="/employee/orders_by_date"
              icon={<ClipboardList />}
              title="Заказы сегодня"
              description="Список заказов"
              color="blue"
            />
            <NavCard 
              href="/employee/pickup_orders"
              icon={<Truck />}
              title="Самовывоз"
              description="Заказы к выдаче"
              color="emerald"
            />
          </div>
        )}

        {/* Active Orders List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Активные заказы</h2>
              <p className="text-sm text-slate-500 mt-1">{format(new Date(), 'd MMMM yyyy', { locale: ru })}</p>
            </div>
            {role === 'employee' && (
              <Link href="/employee/orders_by_date" className="text-sm text-blue-600 font-medium hover:underline">Все заказы</Link>
            )}
            {role === 'admin' && (
              <Link href="/admin/orders" className="text-sm text-blue-600 font-medium hover:underline">Все заказы</Link>
            )}
          </div>
          <div className="p-0">
            {ordersLoading ? (
              <div className="p-8 text-center text-slate-400">Загрузка заказов...</div>
            ) : todayOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Заказов пока нет</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayOrders.slice(0, 10).map((order) => (
                  <Link 
                    key={order.id} 
                    href={role === 'admin' ? `/admin/orders/${order.id}` : `/employee/order_details/${order.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{order.orderNumber || 'Без номера'}</p>
                        <p className="text-xs text-slate-500">{order.carrier} · {order.quantity} мест</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        ['Готов к выдаче', 'Оформлен'].includes(order.status) ? 'bg-emerald-100 text-emerald-800' :
                        ['Комплектация', 'В работе'].includes(order.status) ? 'bg-blue-100 text-blue-800' :
                        order.status === 'Новый' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'Ожидает оформления' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {order.status}
                      </span>
                      <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {todayOrders.length > 10 && (
              <div className="p-4 text-center border-t border-slate-100">
                <Link 
                  href={role === 'admin' ? "/admin/orders" : "/employee/orders_by_date"}
                  className="text-sm text-blue-600 font-medium hover:underline"
                >
                  Показать все {todayOrders.length} заказов
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
    >
      <div className={`w-12 h-12 ${colorMap[color]} rounded-xl flex items-center justify-center mb-4`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' }) : icon}
      </div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
    </motion.div>
  );
}

function NavCard({ href, icon, title, description, color }: { href: string; icon: React.ReactNode; title: string; description: string; color: string }) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Link 
      href={href}
      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:bg-slate-50 transition-all group"
    >
      <div className={`w-10 h-10 ${colorMap[color]} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' }) : icon}
      </div>
      <div>
        <p className="font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}