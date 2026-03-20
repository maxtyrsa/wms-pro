import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function getOrderById(id: string) {
  const docRef = doc(db, 'orders', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as any;
  } else {
    throw new Error('Заказ не найден');
  }
}

export async function updateOrderMoney(id: string, data: {
  payment_sum: number;
  delivery_cost: number;
  profit: number;
}) {
  const docRef = doc(db, 'orders', id);
  await updateDoc(docRef, data);
}

export async function updateOrderStatus(id: string, newStatus: string, userEmail: string) {
  const docRef = doc(db, 'orders', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Заказ не найден');
  
  const order = docSnap.data();
  const history = order.history || [];
  
  // Проверка типа ТК
  if (order.carrier === 'Самовывоз' && (newStatus === 'Ожидает оформления' || newStatus === 'Оформлен')) {
    throw new Error('Для самовывоза недоступны статусы оформления');
  }

  const updateData: any = {
    status: newStatus,
    history: [...history, { status: newStatus, timestamp: new Date().toISOString(), user: userEmail }]
  };

  if (newStatus === 'Завершен') {
    updateData.shippedAt = serverTimestamp();
  }

  await updateDoc(docRef, updateData);
}

export async function createOrderClient(data: {
  orderNumber?: string;
  quantity: number;
  carrier: string;
  department: string;
  userEmail: string;
}) {
  const { orderNumber, quantity, carrier, department, userEmail } = data;

  const ordersRef = collection(db, 'orders');
  
  // 1. Duplicate check
  if (orderNumber) {
    const q1 = query(ordersRef, where('orderNumber', '==', orderNumber));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      throw new Error('Заказ с таким номером уже существует');
    }
  }

  // 2. Auto-status
  const status = 'Новый';

  // 3. Metadata
  const createdAt = new Date().toISOString();
  const history = [
    {
      status,
      timestamp: createdAt,
      user: userEmail
    }
  ];

  // 4. Save to Firestore
  const docRef = await addDoc(ordersRef, {
    orderNumber: orderNumber || null,
    quantity,
    carrier,
    department,
    status,
    createdAt,
    createdBy: userEmail,
    history
  });

  return { id: docRef.id, carrier };
}
