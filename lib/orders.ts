// lib/orders.ts
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  writeBatch,
  arrayUnion 
} from 'firebase/firestore';

export interface HistoryEntry {
  status: string;
  timestamp: string;
  user: string;
  action?: 'created' | 'status_changed' | 'added_to_consolidation' | 'removed_from_consolidation';
  consolidationId?: string;
  consolidationNumber?: string;
  comment?: string;
}

/**
 * Получить заказ по ID
 */
export async function getOrderById(id: string) {
  const docRef = doc(db, 'orders', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as any;
  } else {
    throw new Error('Заказ не найден');
  }
}

/**
 * Обновить финансовые данные заказа
 */
export async function updateOrderMoney(id: string, data: {
  payment_sum: number;
  delivery_cost: number;
  profit: number;
}) {
  const docRef = doc(db, 'orders', id);
  await updateDoc(docRef, {
    ...data,
    lastUpdated: serverTimestamp()
  });
}

/**
 * 🔥 ОСНОВНАЯ ФУНКЦИЯ: Изменение статуса заказа с записью в историю
 * Эту функцию нужно использовать ВЕЗДЕ для изменения статуса
 */
export async function updateOrderStatus(
  orderId: string, 
  newStatus: string, 
  userEmail: string, 
  comment?: string
): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    throw new Error('Заказ не найден');
  }
  
  const order = orderSnap.data();
  const currentStatus = order.status;
  
  // Не обновляем, если статус не изменился
  if (currentStatus === newStatus) {
    console.warn(`Статус заказа ${orderId} уже "${newStatus}"`);
    return;
  }

  // Получаем текущую историю как массив
  const currentHistory = order.history || [];
  
  // Создаем новую запись в историю
  const historyEntry: HistoryEntry = {
    status: newStatus,
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: 'status_changed',
    comment
  };

  // Создаем новый массив с добавленной записью
  const updatedHistory = [...currentHistory, historyEntry];

  // Базовые поля для обновления
  const updateData: any = {
    status: newStatus,
    history: updatedHistory,
    lastStatusUpdate: serverTimestamp(),
    lastStatusUpdateBy: userEmail,
    previousStatus: currentStatus
  };

  // Дополнительные поля в зависимости от статуса
  switch (newStatus) {
    case 'Отправлен':
      updateData.shippedAt = serverTimestamp();
      break;
    case 'Выдан':
      updateData.issuedAt = serverTimestamp();
      updateData.issuedBy = userEmail;
      break;
    case 'Завершен':
      updateData.completedAt = serverTimestamp();
      break;
    case 'В работе':
      if (currentStatus === 'Новый' && !order.time_start) {
        updateData.time_start = serverTimestamp();
      }
      break;
  }

  await updateDoc(orderRef, updateData);
  console.log(`✅ Статус заказа ${orderId} изменен с "${currentStatus}" на "${newStatus}". История обновлена.`);
}

/**
 * 🔥 МАССОВОЕ ИЗМЕНЕНИЕ СТАТУСОВ с записью в историю
 */
export async function bulkUpdateOrderStatus(
  orderIds: string[], 
  newStatus: string, 
  userEmail: string
): Promise<{ success: number; skipped: number }> {
  if (orderIds.length === 0) return { success: 0, skipped: 0 };
  
  const timestamp = new Date().toISOString();
  let successCount = 0;
  let skippedCount = 0;
  
  // Сначала получаем все заказы
  const ordersPromises = orderIds.map(id => getOrderById(id).catch(() => null));
  const orders = await Promise.all(ordersPromises);
  
  // Используем batch для атомарного обновления
  const batch = writeBatch(db);
  
  for (let i = 0; i < orderIds.length; i++) {
    const order = orders[i];
    const orderId = orderIds[i];
    
    if (!order) {
      console.warn(`Заказ ${orderId} не найден`);
      continue;
    }
    
    // Пропускаем заказы с тем же статусом
    if (order.status === newStatus) {
      skippedCount++;
      continue;
    }
    
    const orderRef = doc(db, 'orders', orderId);
    
    // Получаем текущую историю
    const currentHistory = order.history || [];
    
    // Создаем новую запись
    const historyEntry: HistoryEntry = {
      status: newStatus,
      timestamp,
      user: userEmail,
      action: 'status_changed'
    };
    
    // Создаем обновленный массив истории
    const updatedHistory = [...currentHistory, historyEntry];
    
    const updateData: any = {
      status: newStatus,
      history: updatedHistory,
      lastStatusUpdate: serverTimestamp(),
      lastStatusUpdateBy: userEmail,
      previousStatus: order.status
    };

    if (newStatus === 'Отправлен') {
      updateData.shippedAt = serverTimestamp();
    }
    if (newStatus === 'Выдан') {
      updateData.issuedAt = serverTimestamp();
      updateData.issuedBy = userEmail;
    }

    batch.update(orderRef, updateData);
    successCount++;
  }

  if (successCount > 0) {
    await batch.commit();
    console.log(`✅ Массовое обновление: ${successCount} заказов получили статус "${newStatus}"`);
  }
  
  return { success: successCount, skipped: skippedCount };
}

/**
 * 🔥 Добавить заказ в консолидацию с правильной записью consolidationNumber
 */
export async function addOrderToConsolidation(
  orderId: string, 
  consolidationId: string, 
  consolidationNumber: string, 
  userEmail: string
) {
  const docRef = doc(db, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Заказ не найден');
  
  const order = docSnap.data();
  const currentHistory = order.history || [];
  
  const historyEntry: HistoryEntry = {
    status: 'В консолидации',
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: 'added_to_consolidation',
    consolidationId,
    consolidationNumber
  };

  const updatedHistory = [...currentHistory, historyEntry];

  await updateDoc(docRef, {
    status: 'В консолидации',
    consolidationId,
    consolidationNumber,
    history: updatedHistory,
    consolidatedAt: serverTimestamp(),
    consolidatedBy: userEmail,
    previousStatus: order.status
  });
  
  console.log(`✅ Заказ ${orderId} добавлен в консоль ${consolidationNumber}`);
}

/**
 * Удалить заказ из консолидации
 */
export async function removeOrderFromConsolidation(orderId: string, userEmail: string) {
  const docRef = doc(db, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Заказ не найден');
  
  const order = docSnap.data();
  const targetStatus = order.previousStatus || 'Оформлен';
  const currentHistory = order.history || [];

  const historyEntry: HistoryEntry = {
    status: targetStatus,
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: 'removed_from_consolidation'
  };

  const updatedHistory = [...currentHistory, historyEntry];

  await updateDoc(docRef, {
    status: targetStatus,
    consolidationId: null,
    consolidationNumber: null,
    history: updatedHistory,
    previousStatus: null,
    lastUpdated: serverTimestamp()
  });
  
  console.log(`✅ Заказ ${orderId} удален из консолидации`);
}

/**
 * Создать новый заказ
 */
export async function createOrderClient(data: {
  orderNumber?: string;
  quantity: number;
  carrier: string;
  department: string;
  userEmail: string;
}) {
  const { orderNumber, quantity, carrier, department, userEmail } = data;
  const ordersRef = collection(db, 'orders');
  
  // Проверка дубликата
  if (orderNumber) {
    const q1 = query(ordersRef, where('orderNumber', '==', orderNumber));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      throw new Error('Заказ с таким номером уже существует');
    }
  }

  const status = 'Новый';
  const createdAt = new Date().toISOString();
  
  const historyEntry: HistoryEntry = {
    status,
    timestamp: createdAt,
    user: userEmail,
    action: 'created'
  };

  const docRef = await addDoc(ordersRef, {
    orderNumber: orderNumber || null,
    quantity,
    carrier,
    department,
    status,
    createdAt,
    createdBy: userEmail,
    history: [historyEntry]
  });

  console.log(`✅ Создан новый заказ ${docRef.id}`);
  return { id: docRef.id, carrier };
}

/**
 * 🔥 Начать сборку заказа
 */
export async function startOrderAssembly(orderId: string, userEmail: string) {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    throw new Error('Заказ не найден');
  }
  
  const order = orderSnap.data();
  const currentHistory = order.history || [];
  
  const historyEntry: HistoryEntry = {
    status: 'В работе',
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: 'status_changed'
  };

  const updatedHistory = [...currentHistory, historyEntry];

  await updateDoc(orderRef, {
    status: 'В работе',
    time_start: serverTimestamp(),
    history: updatedHistory,
    assemblyStartedBy: userEmail,
    previousStatus: order.status
  });
  
  console.log(`✅ Сборка заказа ${orderId} начата`);
}

/**
 * 🔥 Завершить сборку заказа
 */
export async function finishOrderAssembly(orderId: string, userEmail: string) {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    throw new Error('Заказ не найден');
  }
  
  const order = orderSnap.data();
  const currentHistory = order.history || [];
  
  let newStatus: string;
  if (order.carrier === 'Самовывоз') {
    newStatus = 'Готов к выдаче';
  } else {
    newStatus = 'Комплектация';
  }

  const historyEntry: HistoryEntry = {
    status: newStatus,
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: 'status_changed'
  };

  const updatedHistory = [...currentHistory, historyEntry];

  await updateDoc(orderRef, {
    status: newStatus,
    time_end: serverTimestamp(),
    history: updatedHistory,
    assemblyFinishedBy: userEmail,
    previousStatus: order.status
  });
  
  console.log(`✅ Сборка заказа ${orderId} завершена, новый статус: ${newStatus}`);
}

/**
 * 🔥 Отметить заказ как выданный (для самовывоза)
 */
export async function markOrderAsIssued(orderId: string, userEmail: string) {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    throw new Error('Заказ не найден');
  }
  
  const order = orderSnap.data();
  const currentHistory = order.history || [];
  
  const historyEntry: HistoryEntry = {
    status: 'Выдан',
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: 'status_changed'
  };

  const updatedHistory = [...currentHistory, historyEntry];

  await updateDoc(orderRef, {
    status: 'Выдан',
    issuedAt: serverTimestamp(),
    issuedBy: userEmail,
    history: updatedHistory,
    previousStatus: order.status
  });
  
  console.log(`✅ Заказ ${orderId} выдан клиенту`);
}

/**
 * 🔥 Сохранить габариты и перевести в статус "Ожидает оформления"
 */
export async function saveDimensionsAndUpdateStatus(
  orderId: string, 
  userEmail: string,
  placesData: Array<{ d: number; w: number; h: number; weight: number }>,
  totalVolume: number,
  totalWeight: number
) {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    throw new Error('Заказ не найден');
  }
  
  const order = orderSnap.data();
  const currentHistory = order.history || [];
  const newStatus = 'Ожидает оформления';
  
  const historyEntry: HistoryEntry = {
    status: newStatus,
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: 'status_changed'
  };

  const updatedHistory = [...currentHistory, historyEntry];

  await updateDoc(orderRef, {
    places_data: placesData,
    totalVolume,
    totalWeight,
    status: newStatus,
    history: updatedHistory,
    dimensionsSavedAt: serverTimestamp(),
    dimensionsSavedBy: userEmail,
    previousStatus: order.status
  });
  
  console.log(`✅ Габариты сохранены, заказ ${orderId} переведен в статус "${newStatus}"`);
}

/**
 * 🔥 Обновить статус заказа через старую функцию (для обратной совместимости)
 * @deprecated Используйте updateOrderStatus вместо этой функции
 */
export async function updateOrderStatusLegacy(id: string, newStatus: string, userEmail: string, comment?: string) {
  return updateOrderStatus(id, newStatus, userEmail, comment);
}