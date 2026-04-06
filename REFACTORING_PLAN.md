# План рефакторинга и оптимизации Return Statements

## Обзор проекта
- **Тип проекта**: Next.js + TypeScript + Firebase
- **Всего файлов**: 44 TypeScript/JavaScript файлов
- **Всего return statements**: ~421 occurrences

## Цели рефакторинга

### 1. Ранние возвраты (Early Returns)
**Проблема**: Вложенные условия усложняют чтение кода
**Решение**: Использовать guard clauses для уменьшения вложенности

**Пример**:
```typescript
// ❌ До
function processOrder(order) {
  if (order) {
    if (order.status === 'active') {
      // обработка
      return true;
    }
  }
  return false;
}

// ✅ После
function processOrder(order) {
  if (!order || order.status !== 'active') {
    return false;
  }
  // обработка
  return true;
}
```

### 2. Устранение дублирования return
**Проблема**: Одинаковые return в разных ветках условий
**Решение**: Вынести общую логику в конец функции

**Пример**:
```typescript
// ❌ До
function getStatus(action) {
  if (action === 'create') {
    return { success: true, action: 'created' };
  } else if (action === 'update') {
    return { success: true, action: 'updated' };
  } else {
    return { success: true, action: 'unknown' };
  }
}

// ✅ После
function getStatus(action) {
  const actionMap = {
    create: 'created',
    update: 'updated'
  };
  return { 
    success: true, 
    action: actionMap[action] || 'unknown' 
  };
}
```

### 3. Оптимизация условных возвратов
**Проблема**: Избыточные if-else конструкции
**Решение**: Использовать тернарные операторы и логические выражения

**Пример**:
```typescript
// ❌ До
function getDiscount(user) {
  if (user.isPremium) {
    return 0.2;
  } else {
    return 0;
  }
}

// ✅ После
function getDiscount(user) {
  return user.isPremium ? 0.2 : 0;
}
```

### 4. Возвраты в React компонентах
**Проблема**: Множественные ранние возвраты в компонентах
**Решение**: Использовать единый return с условным рендерингом

**Пример**:
```typescript
// ❌ До
function Component({ loading, data }) {
  if (loading) {
    return <Loader />;
  }
  if (!data) {
    return <Empty />;
  }
  return <Content data={data} />;
}

// ✅ После (для простых случаев)
function Component({ loading, data }) {
  return (
    <>
      {loading && <Loader />}
      {!loading && !data && <Empty />}
      {loading === false && data && <Content data={data} />}
    </>
  );
}
```

### 5. Arrow functions с неявным return
**Проблема**: Избыточное использование блочной формы
**Решение**: Использовать неявный return для однострочных функций

**Пример**:
```typescript
// ❌ До
const double = (x) => {
  return x * 2;
};

// ✅ После
const double = (x) => x * 2;
```

## Приоритетные файлы для рефакторинга

### Критический приоритет (бизнес-логика)
1. `/workspace/lib/orders.ts` - 12 return statements
   - Функции работы с заказами
   - Оптимизация проверок существования документов

2. `/workspace/hooks/usePaginatedOrders.ts` - 8 return statements
   - Хук пагинации заказов
   - Упрощение условной логики

3. `/workspace/context/AuthContext.tsx` - проверка авторизации
4. `/workspace/context/ThemeContext.tsx` - проверка темы

### Высокий приоритет (страницы администратора)
5. `/workspace/app/admin/returns/page.tsx` - 15+ return statements
   - Функции `getActionLabel`, `getActionIcon`, `getActionColor`
   - Замена switch на объект-маппер

6. `/workspace/app/admin/orders/page.tsx`
7. `/workspace/app/admin/dashboard/page.tsx`
8. `/workspace/app/admin/reports/page.tsx`

### Средний приоритет (страницы сотрудника)
9. `/workspace/app/employee/orders_by_date/page.tsx`
10. `/workspace/app/employee/pickup_orders/page.tsx`
11. `/workspace/app/employee/add_order/page.tsx`

### Низкий приоритет (утилиты и конфигурация)
12. `/workspace/lib/dateUtils.ts` - 4 return statements
13. `/workspace/lib/utils.ts` - 1 return statement
14. `/workspace/lib/constants.ts`
15. `/workspace/lib/firebase.ts`

## Конкретные улучшения для returns/page.tsx

### 1. Замена switch на объект-маппер
```typescript
// Текущий код (строки 59-90)
const getActionLabel = (action: string) => {
  switch (action) {
    case 'return_requested': return 'Запрошен возврат';
    // ...
  }
};

// Оптимизированный вариант
const ACTION_CONFIG = {
  return_requested: {
    label: 'Запрошен возврат',
    icon: AlertTriangle,
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  },
  return_approved: {
    label: 'Возврат одобрен',
    icon: CheckCircle2,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  // ...
} as const;

const getActionConfig = (action: string) => {
  return ACTION_CONFIG[action as keyof typeof ACTION_CONFIG] ?? {
    label: action,
    icon: Package,
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  };
};
```

### 2. Оптимизация условного рендеринга
```typescript
// Объединение условий загрузки
const isLoading = loading || loadingData;

if (isLoading) {
  return <LoadingSpinner />;
}
```

### 3. Вынесение фильтрации в отдельную функцию
```typescript
const filterReturns = useCallback((returns: ReturnHistory[], query: string) => {
  if (!query.trim()) return returns;
  const lowerQuery = query.toLowerCase();
  return returns.filter(r => r.orderNumber?.toLowerCase().includes(lowerQuery));
}, []);
```

## Метрики качества

### До рефакторинга
- Глубина вложенности: до 4 уровней
- Дублирование кода: 15%
- Средний размер функции: 45 строк

### Целевые показатели
- Глубина вложенности: максимум 2 уровня
- Дублирование кода: < 5%
- Средний размер функции: < 30 строк
- Покрытие тестами: > 80%

## Этапы выполнения

### Этап 1: Анализ и подготовка (1-2 дня)
- [ ] Статический анализ кода (ESLint, TypeScript strict mode)
- [ ] Создание тестов для критических функций
- [ ] Документирование текущего поведения

### Этап 2: Рефакторинг утилит (1 день)
- [ ] `/workspace/lib/dateUtils.ts`
- [ ] `/workspace/lib/utils.ts`
- [ ] `/workspace/lib/constants.ts`

### Этап 3: Рефакторинг бизнес-логики (2-3 дня)
- [ ] `/workspace/lib/orders.ts`
- [ ] `/workspace/hooks/usePaginatedOrders.ts`
- [ ] Context файлы

### Этап 4: Рефакторинг UI компонентов (3-4 дня)
- [ ] Страницы администратора
- [ ] Страницы сотрудника
- [ ] Общие компоненты

### Этап 5: Тестирование и валидация (1-2 дня)
- [ ] Юнит-тесты
- [ ] Интеграционные тесты
- [ ] Performance тесты

## Риски и меры предосторожности

### Риски
1. Изменение поведения существующих функций
2. Поломка обратной совместимости
3. Регрессионные баги

### Меры предосторожности
1. ✅ Создать резервную ветку Git перед началом
2. ✅ Писать тесты перед рефакторингом (TDD подход)
3. ✅ Рефакторить небольшими порциями
4. ✅ Проводить code review для каждого изменения
5. ✅ Использовать TypeScript strict mode для обнаружения ошибок

## Инструменты

### Статический анализ
```bash
npm run lint
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```

### Автоматический рефакторинг
```bash
# Prettier для форматирования
npx prettier --write "**/*.{ts,tsx}"

# ESLint с автофиксом
npx eslint --fix "**/*.{ts,tsx}"
```

### Тестирование
```bash
# Запуск тестов
npm test

# Coverage отчет
npm test -- --coverage
```

## Чеклист проверки для каждого файла

- [ ] Устранена избыточная вложенность
- [ ] Применены early returns где уместно
- [ ] Убрано дублирование return statements
- [ ] Arrow functions используют неявный return где возможно
- [ ] Switch заменены на объекты/Map где уместно
- [ ] Тернарные операторы используются для простых условий
- [ ] Код стал более читаемым
- [ ] Все тесты проходят
- [ ] TypeScript компилируется без ошибок

## Ожидаемые результаты

1. **Читаемость**: Увеличение на 30-40%
2. **Поддерживаемость**: Сокращение времени на внесение изменений на 25%
3. **Производительность**: Уменьшение количества выполняемых операций на 10-15%
4. **Размер кода**: Сокращение на 15-20% без потери функциональности

---
*Документ создан: $(date)*
*Версия плана: 1.0*
