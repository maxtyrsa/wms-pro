// lib/dateUtils.ts
import { startOfMonth, endOfMonth, format } from 'date-fns';

/**
 * Возвращает даты начала и конца текущего месяца
 */
export const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end: format(endOfMonth(now), 'yyyy-MM-dd'),
    startDate: startOfMonth(now),
    endDate: endOfMonth(now)
  };
};

/**
 * Форматирует диапазон дат для отображения
 */
export const formatDateRange = (start: string, end: string) => {
  if (start === end) {
    return format(new Date(start), 'dd.MM.yyyy');
  }
  return `${format(new Date(start), 'dd.MM')} - ${format(new Date(end), 'dd.MM')}`;
};