'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  DocumentData, 
  QueryConstraint, 
  Timestamp 
} from 'firebase/firestore';

// Интерфейс для фильтров, передаваемых в хук
interface Filters {
  status?: string;
  carrier?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Кастомный хук для получения заказов из Firestore с серверной пагинацией и фильтрацией.
 * @param initialLimit - Количество документов на странице.
 * @param filters - Объект с фильтрами (status, carrier, startDate, endDate).
 * @param searchTerm - Строка для поиска по полю orderNumber.
 */
const usePaginatedOrders = (initialLimit: number, filters: Filters, searchTerm: string) => {
  const [orders, setOrders] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Основная функция для загрузки данных
  const fetchOrders = useCallback(async (isLoadMore = false) => {
    // Устанавливаем правильный флаг загрузки
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      // При новом поиске/фильтрации сбрасываем пагинацию
      setLastDoc(null);
    }
    setError(null);

    try {
      // Массив для хранения всех условий запроса
      const constraints: QueryConstraint[] = [];

      // --- Фильтрация ---
      if (searchTerm) {
        // Поиск по точному совпадению номера заказа. Не является range-фильтром.
        constraints.push(where('orderNumber', '==', searchTerm.trim()));
      }
      if (filters.status && filters.status !== 'Все') {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters.carrier && filters.carrier !== 'Все') {
        constraints.push(where('carrier', '==', filters.carrier));
      }
      // Фильтр по датам - это range-фильтр. Firestore позволяет иметь только один такой в запросе.
      if (filters.startDate) {
        constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters.endDate) {
        constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.endDate)));
      }
      
      // --- Конструктор запроса ---
      const q = query(
        collection(db, 'orders'),
        ...constraints, // Применяем все собранные фильтры
        orderBy('createdAt', 'desc'), // Обязательная сортировка для пагинации
        // Если это подгрузка, начинаем после последнего документа
        ...(isLoadMore && lastDoc ? [startAfter(lastDoc)] : []),
        limit(initialLimit) // Ограничиваем количество
      );

      const documentSnapshots = await getDocs(q);
      const newOrders = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Обновляем состояние
      if (isLoadMore) {
        setOrders(prevOrders => [...prevOrders, ...newOrders]);
      } else {
        setOrders(newOrders); // При новом фильтре заменяем старые данные
      }
      
      // Есть ли еще страницы? Проверяем, получили ли мы столько же документов, сколько запрашивали.
      setHasMore(newOrders.length === initialLimit);
      // Сохраняем последний документ для следующего запроса
      setLastDoc(documentSnapshots.docs[documentSnapshots.docs.length - 1] || null);

    } catch (err: any) {
      // Важно: выводим оригинальную ошибку. В ней будет ссылка для создания индекса.
      console.error("FIREBASE QUERY ERROR:", err);
      setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, searchTerm, initialLimit, lastDoc]); // Зависимости для useCallback

  // Этот эффект отвечает за перезагрузку данных при изменении фильтров или поиска
  useEffect(() => {
    // Создаем вложенную функцию, чтобы избежать проблем со старыми замыканиями
    const refetch = () => {
        setLastDoc(null); // Сбрасываем пагинацию
        fetchOrders(false); // Выполняем новый запрос, не подгрузку
    }
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, searchTerm, initialLimit]); // Перезапускаем только при изменении этих зависимостей


  // Возвращаем все необходимые данные и функции для использования в компоненте
  return { 
    orders,         // Массив заказов
    setOrders,      // Функция для ручного обновления массива (для оптимистичных апдейтов)
    loading,        // Идет ли основная загрузка
    loadingMore,    // Идет ли подгрузка страницы
    hasMore,        // Есть ли еще данные для загрузки
    error,          // Объект ошибки
    loadMore: () => fetchOrders(true) // Функция для вызова подгрузки
  };
};

export default usePaginatedOrders;
