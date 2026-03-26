'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Package, Search, XCircle, Layers, Loader2, ChevronDown
} from 'lucide-react';
import { CreateConsolidationModal } from '@/components/consolidation/CreateConsolidationModal';
import usePaginatedOrders from '@/hooks/usePaginatedOrders';

const PAGE_SIZE = 50; // Increased page size for this view

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export function ShippedOrdersList() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchTerm = useDebounce(searchQuery, 500);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('Все');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filters = useMemo(() => ({
    status: 'Оформлен', // Hardcoded status for this component
    carrier: selectedCarrier === 'Все' ? undefined : selectedCarrier,
    // No date filter in this component, but can be added easily
  }), [selectedCarrier]);

  const {
    orders,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    setOrders
  } = usePaginatedOrders(PAGE_SIZE, filters, debouncedSearchTerm);

  const displayOrders = useMemo(() => {
    return orders.filter(o => o.carrier !== 'Самовывоз');
  }, [orders]);

  const carriersOnPage = useMemo(() => {
    const uniqueCarriers = new Set(orders.map(o => o.carrier).filter(c => c && c !== 'Самовывоз'));
    return ['Все', ...Array.from(uniqueCarriers)];
  }, [orders]);

  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) newSelection.delete(orderId); else newSelection.add(orderId);
    setSelectedOrders(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedOrders.size === displayOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(displayOrders.map(o => o.id)));
    }
  };
  
  const onConsolidationSuccess = (createdConsolidation: any) => {
    const consolidatedOrderIds = new Set(createdConsolidation.orders.map((o: any) => o.id));
    setOrders(prev => prev.filter(o => !consolidatedOrderIds.has(o.id)));
    setSelectedOrders(new Set());
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Поиск по номеру..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 py-3 rounded-lg border bg-slate-50" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2"><XCircle /></button>}
          </div>
          <select value={selectedCarrier} onChange={e => setSelectedCarrier(e.target.value)} className="w-full py-3 px-4 rounded-lg border bg-slate-50">
            {carriersOnPage.map(carrier => <option key={carrier} value={carrier}>{carrier}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="p-4 bg-red-100 text-red-700 rounded-lg"><b>Ошибка:</b> {error.message}</p>}

      {/* Selection Panel */}
      <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between">
        <div>
          <button onClick={toggleAllSelection} className="flex items-center gap-2 text-sm">
            <input type="checkbox" readOnly checked={selectedOrders.size === displayOrders.length && displayOrders.length > 0} className="form-checkbox h-4 w-4" />
            Выбрать все на странице
          </button>
          <span className="ml-4 text-sm">Выбрано: <b>{selectedOrders.size}</b></span>
        </div>
        {selectedOrders.size > 0 && 
            <button onClick={() => setShowCreateModal(true)} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                <Layers size={16} /> Создать консоль
            </button>
        }
      </div>

      {/* Orders List */}
      {loading && displayOrders.length === 0 ? (
          <div className="text-center py-12"><Loader2 className="animate-spin inline-block h-8 w-8"/></div>
      ) : displayOrders.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-white border">
              <Package className="mx-auto h-12 w-12 text-slate-300"/>
              <p className="mt-2 text-slate-500">Нет заказов для консолидации.</p>
          </div>
      ) : (
        <div className="space-y-3">
          {displayOrders.map(order => (
            <div key={order.id} onClick={() => toggleOrderSelection(order.id)} className={`p-4 rounded-xl border shadow-sm cursor-pointer ${selectedOrders.has(order.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
              <h3 className="font-bold">Заказ №{order.orderNumber}</h3>
              <p>{order.carrier}</p>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
          <div className="text-center mt-6">
              <button onClick={loadMore} disabled={loadingMore} className="px-6 py-3 bg-slate-100 rounded-xl font-medium disabled:opacity-50">
                  {loadingMore ? <Loader2 className="animate-spin"/> : 'Загрузить еще'}
              </button>
          </div>
      )}

      <CreateConsolidationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        selectedOrders={displayOrders.filter(o => selectedOrders.has(o.id))}
        onSuccess={onConsolidationSuccess}
      />
    </div>
  );
}
