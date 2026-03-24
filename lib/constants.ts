export const ORDER_STATUSES = {
  // Основные статусы
  NEW: 'Новый',
  ASSEMBLY: 'Комплектация',
  AWAITING: 'Ожидает оформления',
  READY: 'Готов к выдаче',
  PROCESSED: 'Оформлен',
  SHIPPED: 'Отправлен',
  COMPLETED: 'Завершен',
  ISSUED: 'Выдан',
  
  // Статусы для возвратов
  RETURN_REQUESTED: 'Запрошен возврат',
  RETURN_APPROVED: 'Возврат одобрен',
  RETURN_RECEIVED: 'Возврат получен',
  RETURN_REJECTED: 'Возврат отклонен',
  REPROCESSING: 'На повторной обработке',
  RESHIPPING: 'Повторная отправка'
};

export const RETURN_REASONS = [
  { value: 'DAMAGED', label: 'Повреждение при транспортировке', icon: 'AlertTriangle' },
  { value: 'WRONG_ITEM', label: 'Ошибочный товар', icon: 'Package' },
  { value: 'QUALITY', label: 'Не соответствует качеству', icon: 'AlertTriangle' },
  { value: 'CUSTOMER_CANCELLED', label: 'Отказ клиента', icon: 'XCircle' },
  { value: 'DELIVERY_FAILED', label: 'Неудачная доставка', icon: 'Truck' },
  { value: 'OTHER', label: 'Другая причина', icon: 'FileText' }
];

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'Новый': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'Комплектация': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'В работе': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Ожидает оформления': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'Готов к выдаче': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'Оформлен': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
    case 'Отправлен': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'Завершен': return 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    case 'Выдан': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'Запрошен возврат': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'Возврат одобрен': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Возврат получен': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'На повторной обработке': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'Повторная отправка': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
};
