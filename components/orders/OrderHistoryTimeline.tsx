import { motion } from 'framer-motion';
import { HistoryEntry } from '../../lib/orders';
import { getStatusColor } from '../../lib/constants';
import { format } from 'date-fns';
import { CheckCircle, Clock, Package, Truck, User, Layers, ArchiveOut } from 'lucide-react';

interface OrderHistoryTimelineProps {
  history: HistoryEntry[];
}

const getStatusIcon = (status: string, action?: string) => {
  if (action === 'added_to_consolidation') {
    return <Layers className="h-5 w-5" />;
  }
  if (action === 'removed_from_consolidation') {
    return <ArchiveOut className="h-5 w-5" />;
  }
  switch (status) {
    case 'Новый':
      return <Package className="h-5 w-5" />;
    case 'В работе':
    case 'Комплектация':
      return <Clock className="h-5 w-5" />;
    case 'Готов к отгрузке':
    case 'Готов к выдаче':
      return <CheckCircle className="h-5 w-5" />;
    case 'Отправлен':
    case 'Выдан':
      return <Truck className="h-5 w-5" />;
    default:
      return <User className="h-5 w-5" />;
  }
};

const getActionLabel = (entry: HistoryEntry) => {
  if (entry.action === 'added_to_consolidation' && entry.consolidationNumber) {
    return `Добавлен в консоль ${entry.consolidationNumber}`;
  }
  if (entry.action === 'removed_from_consolidation') {
    return 'Удален из консолидации';
  }
  if (entry.action === 'created') {
    return 'Заказ создан';
  }
  return null;
};

const OrderHistoryTimeline: React.FC<OrderHistoryTimelineProps> = ({ history }) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <h3 className="text-lg font-semibold mb-4">История изменений</h3>
      <div className="relative border-l-2 border-gray-200 dark:border-gray-700">
        {history.map((entry, index) => {
          const actionLabel = getActionLabel(entry);
          const isInConsolidation = entry.action === 'added_to_consolidation';
          
          return (
            <motion.div
              key={index}
              className="mb-10 ml-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <span
                className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-white dark:ring-gray-900 ${
                  isInConsolidation 
                    ? 'bg-purple-100 dark:bg-purple-900' 
                    : entry.action === 'removed_from_consolidation'
                    ? 'bg-orange-100 dark:bg-orange-900'
                    : 'bg-blue-100 dark:bg-blue-900'
                }`}
              >
                {getStatusIcon(entry.status, entry.action)}
              </span>
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-700 dark:border-gray-600">
                <div className="items-center justify-between sm:flex">
                  <time className="mb-1 text-xs font-normal text-gray-400 sm:order-last sm:mb-0">
                    {format(new Date(entry.timestamp as string), 'dd.MM.yyyy HH:mm')}
                  </time>
                  <div className={`text-sm font-normal ${isInConsolidation ? 'text-purple-600 dark:text-purple-400' : getStatusColor(entry.status)}`}>
                    <span
                      className="font-semibold text-gray-900 dark:text-white"
                    >
                      {actionLabel || entry.status}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm font-normal text-gray-500 dark:text-gray-300">
                  <p>Пользователь: {entry.user}</p>
                  {entry.comment && <p>Комментарий: {entry.comment}</p>}
                  {entry.consolidationNumber && entry.action !== 'added_to_consolidation' && (
                    <p className="text-purple-600 dark:text-purple-400">Консоль: {entry.consolidationNumber}</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default OrderHistoryTimeline;
