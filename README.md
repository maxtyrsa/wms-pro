<div align="center">
<img width="524" height="524" alt="GHBanner" src="public/icon.png" />
</div>

# 📦 Система Управления Московским складом Kupi-Flakon

**Warehouse Management System Kupi-Flakon**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Enabled-orange?logo=firebase)](https://firebase.google.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

---

## 🚀 Быстрый старт

```bash
# 1. Клонирование репозитория
git clone <repository-url>
cd wms-pro-fix_wms

# 2. Установка зависимостей
npm install

# 3. Настройка переменных окружения
cp .env.example .env.local
# Отредактируйте .env.local, добавив ваши Firebase credentials

# 4. Запуск разработки
npm run dev

# 5. Сборка для продакшена
npm run build
npm run start
```

**Доступные роли по умолчанию:**
- **Admin**: `maximtyrsa89@gmail.com` (супер-админ, создаётся автоматически)
- **Employee**: добавляются через панель администратора

---

## 📦 Установка и настройка

### Требования к окружению

| Компонент | Версия | Примечание |
|-----------|--------|------------|
| Node.js | ≥20.x | LTS версия рекомендуется |
| npm | ≥10.x | Или используйте pnpm/yarn |
| Firebase Project | Active | Требуется проект с Auth + Firestore |

### Пошаговая установка

```bash
# Проверка версии Node.js
node -v  # Должно быть 20.x или выше

# Установка зависимостей
npm install

# Проверка TypeScript
npx tsc --noEmit

# Запуск в режиме разработки
npm run dev  # http://localhost:3000
```

### Структура проекта

```
wms-pro-fix_wms/
├── app/                          # Next.js App Router
│   ├── admin/                    # Панель администратора
│   │   ├── consolidations/       # Консоли отправки
│   │   ├── dashboard/            # Аналитика и KPI
│   │   ├── jambs/                # Модуль ошибок
│   │   ├── orders/               # Управление заказами
│   │   ├── pickup_orders/        # Самовывоз
│   │   ├── reports/              # Excel отчёты
│   │   ├── returns/              # История возвратов
│   │   ├── shipments/            # Консолидация
│   │   └── users/                # Управление пользователями
│   ├── employee/                 # Портал сотрудника
│   │   ├── add_dimensions/       # Ввод габаритов
│   │   ├── add_money/            # Финансы заказа
│   │   ├── add_order/            # Создание заказа
│   │   ├── assembly/             # Сборка заказа
│   │   ├── edit_order/           # Редактирование
│   │   ├── order_details/        # Детали заказа
│   │   ├── orders_by_date/       # Заказы за день
│   │   └── pickup_orders/        # Самовывоз
│   ├── login/                    # Страница входа
│   ├── globals.css               # Глобальные стили
│   ├── layout.tsx                # Корневой layout
│   └── page.tsx                  # Главная (дашборд)
├── components/                   # Переиспользуемые компоненты
│   ├── consolidation/            # Модаль создания консоли
│   ├── orders/                   # Списки заказов
│   ├── print/                    # Печать консолей
│   ├── returns/                  # Управление возвратами
│   ├── shipments/                # Списки отправок
│   ├── ui/                       # UI компоненты
│   ├── ErrorBoundary.tsx         # Граница ошибок
│   └── Toast.tsx                 # Уведомления
├── context/                      # React Context
│   ├── AuthContext.tsx           # Аутентификация
│   └── ThemeContext.tsx          # Тёмная/светлая тема
├── hooks/                        # Кастомные хуки
│   ├── use-mobile.ts             # Определение мобильного
│   └── usePaginatedOrders.ts     # Пагинация заказов
├── lib/                          # Утилиты и сервисы
│   ├── constants.ts              # Константы приложения
│   ├── dateUtils.ts              # Работа с датами
│   ├── firebase.ts               # Firebase конфигурация
│   ├── orders.ts                 # Сервис заказов
│   └── utils.ts                  # Общие утилиты
├── .env.local                    # Переменные окружения
├── next.config.ts                # Next.js конфигурация
└── package.json                  # Зависимости
```

---

## 🔐 Переменные окружения (.env)

### Файл `.env.local`

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Super Admin Email (автоматически получает роль admin)
NEXT_PUBLIC_SUPER_ADMIN_EMAIL=maximtyrsa89@gmail.com

# Optional: Analytics & Monitoring
NEXT_PUBLIC_APP_ENV=development  # development | production
NEXT_PUBLIC_SENTRY_DSN=          # Опционально для Sentry
```

### 🔒 Безопасность переменных

| Переменная | Доступ | Примечание |
|------------|--------|------------|
| `NEXT_PUBLIC_*` | Client + Server | Экспортируются на клиент |
| Без префикса | Server only | Только серверный доступ |
| `.env.local` | Git ignored | Не коммитить в репозиторий |

**Важно:**
- ✅ Используйте `.env.example` для шаблона
- ✅ Никогда не коммитьте `.env.local` в Git
- ✅ Ротируйте ключи Firebase при компрометации
- ✅ Настройте Firebase Security Rules (см. ниже)

---

## 🗄️ Firestore индексы и правила безопасности

### Необходимые индексы Firestore

Для работы всех запросов создайте следующие индексы в [Firebase Console](https://console.firebase.google.com/project/_/firestore/indexes):

```javascript
// Collection: orders
// 1. Заказы по дате (основной)
orders: createdAt DESC

// 2. Заказы по статусу + дате
orders: status ASC, createdAt DESC

// 3. Заказы по ТК + дате
orders: carrier ASC, createdAt DESC

// 4. Заказы по статусу + ТК + дате
orders: status ASC, carrier ASC, createdAt DESC

// 5. Заказы по дате (range query)
orders: createdAt ASC, createdAt DESC

// 6. Поиск по orderNumber + дате
orders: orderNumber ASC, createdAt DESC

// Collection: consolidations
// 7. Консоли по статусу + дате
consolidations: status ASC, createdAt DESC

// 8. Консоли по дате
consolidations: createdAt DESC

// Collection: jambs
// 9. Ошибки по дате
jambs: createdAt DESC

// Collection: returns_history
// 10. История возвратов по дате
returns_history: createdAt DESC

// Collection: users
// 11. Пользователи по роли
users: role ASC
```

### Автоматическое создание индексов

При первом запросе Firestore вернёт ссылку для создания индекса. Перейдите по ней для активации.

### Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check auth
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to get user role
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role;
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserRole() == 'admin';
    }
    
    function isEmployee() {
      return isAuthenticated() && getUserRole() == 'employee';
    }
    
    // Users collection - только админы могут управлять
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Orders collection
    match /orders/{orderId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAdmin();
    }
    
    // Consolidations collection - только админы
    match /consolidations/{consolidationId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
    
    // Jambs collection - только админы
    match /jambs/{jambId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
    
    // Returns history - только админы
    match /returns_history/{returnId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

### ⚠️ Критические замечания по безопасности

1. **Email в документе пользователя**: Используйте lowercase email как document ID
2. **Role validation**: Всегда проверяйте роль на сервере для критических операций
3. **Transaction для финансов**: Используйте `runTransaction` для операций с балансом
4. **Rate limiting**: Настройте Firebase App Check для защиты от злоупотреблений

---

## 🏗️ Архитектура проекта

### Архитектурные принципы

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  (app/, components/) - UI, Pages, Client Components         │
├─────────────────────────────────────────────────────────────┤
│                       Business Logic Layer                   │
│  (lib/, services/) - Domain Logic, Validation, Transform    │
├─────────────────────────────────────────────────────────────┤
│                        Data Access Layer                     │
│  (lib/firebase.ts) - Firestore, Auth, External APIs         │
├─────────────────────────────────────────────────────────────┤
│                         Infrastructure                       │
│  (context/, hooks/) - State Management, Utilities           │
└─────────────────────────────────────────────────────────────┘
```

### Ключевые решения

| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| **Framework** | Next.js 15 App Router | Server Components, оптимизация |
| **State** | React Context + useState | Достаточно для масштаба |
| **Database** | Firebase Firestore | Real-time, offline support |
| **Auth** | Firebase Auth | Google + Email/Password |
| **Styling** | Tailwind CSS | Utility-first, dark mode |
| **Animations** | Framer Motion (motion/react) | Performance, gestures |
| **Charts** | Recharts | Lightweight, customizable |
| **Excel** | ExcelJS | Full XLSX support |

### Паттерны использования

```typescript
// ✅ Правильно: Логика вынесена в lib/
// lib/orders.ts
export async function createOrder(data: OrderData): Promise<Order> {
  // Валидация, бизнес-логика, Firestore операции
}

// ✅ Правильно: Строгая типизация
interface Order {
  id: string;
  orderNumber: string | null;
  status: OrderStatus;
  createdAt: string;
  // ... нет any!
}

// ❌ Неправильно: any в продакшен коде
const data: any = await getDocs(query); // Избегать!
```

### Оптимизация производительности

1. **Server Components**: Максимальное использование RSC
2. **Pagination**: Серверная пагинация с `startAfter`
3. **Memoization**: `useMemo`, `useCallback` для тяжёлых вычислений
4. **Lazy Loading**: Динамический импорт тяжёлых компонентов
5. **Image Optimization**: Next.js Image компонент

---

## 👥 Роли и доступы

### Система ролей

| Роль | Доступ | Страницы |
|------|--------|----------|
| **Admin** | Полный доступ | Все разделы `/admin/*` |
| **Employee** | Ограниченный | `/employee/*`, главная |
| **Super Admin** | + Управление пользователями | Автоматически по email |

### Матрица доступов

| Функция | Admin | Employee |
|---------|-------|----------|
| Создание заказов | ✅ | ✅ |
| Редактирование заказов | ✅ | ✅ (до сборки) |
| Изменение статусов | ✅ | ✅ (сборка) |
| Управление пользователями | ✅ | ❌ |
| Просмотр аналитики | ✅ | ❌ |
| Экспорт отчётов | ✅ | ❌ |
| JAMBS модуль | ✅ | ❌ |
| Консолидация | ✅ | ❌ |
| Возвраты | ✅ | ❌ |
| Самовывоз (выдача) | ✅ | ✅ |

### Добавление пользователя

```typescript
// Через панель администратора (/admin/users)
// Или программно:

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

await setDoc(doc(db, 'users', 'employee@email.com'), {
  email: 'employee@email.com',
  displayName: 'Иван Иванов',
  role: 'employee'  // 'admin' | 'employee'
});
```

### Super Admin

Пользователь из `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` автоматически получает роль `admin` при первом входе.

---

## 📊 Мониторинг и логирование

### Логирование в приложении

```typescript
// Консольные логи (удаляются в production через next.config.ts)
console.log('Debug info');      // Удаляется в prod
console.warn('Warning');        // Остаётся
console.error('Error');         // Остаётся

// Toast уведомления
import { showToast } from '@/components/Toast';
showToast('Операция успешна', 'success');
showToast('Ошибка сохранения', 'error');
```

### Firebase Logging

```typescript
// Включение debug режима Firestore
import { setLogLevel } from 'firebase/firestore';
setLogLevel('debug');  // Только в development
```

### Рекомендуемые метрики для отслеживания

| Метрика | Где смотреть | Критичность |
|---------|--------------|-------------|
| Ошибки Auth | Firebase Console → Authentication | 🔴 High |
| Firestore квоты | Firebase Console → Firestore | 🔴 High |
| Время сборки заказов | /admin/dashboard | 🟡 Medium |
| JAMBS count | /admin/jambs | 🟡 Medium |
| Активные пользователи | Firebase Console → Analytics | 🟢 Low |

### Интеграция с Sentry (опционально)

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  tracesSampleRate: 0.1,
});
```

---

## 🛠️ Разработка: скрипты и команды

### package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### Команды разработчика

```bash
# Запуск разработки
npm run dev

# Проверка типов TypeScript
npm run type-check

# Линтинг кода
npm run lint

# Форматирование кода
npm run format

# Сборка для продакшена
npm run build

# Запуск продакшен сборки
npm run start
```

### Git Workflow

```bash
# Создание фичи
git checkout -b feature/new-feature

# Коммит с conventional commits
git commit -m "feat: добавлена новая функция"
git commit -m "fix: исправлена ошибка валидации"
git commit -m "refactor: рефакторинг модуля заказов"

# Пуш и PR
git push origin feature/new-feature
```

### Pre-commit хуки (рекомендуется)

```bash
# Установка Husky
npm install -D husky
npx husky install

# Добавление проверок
npx husky add .husky/pre-commit "npm run type-check && npm run lint"
```

---

## 🐛 Устранение неполадок

### Частые ошибки и решения

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `auth/unauthorized-domain` | Домен не в Firebase Console | Добавить домен в Firebase → Authentication → Settings → Authorized domains |
| `Missing or insufficient permissions` | Firestore Rules блокируют | Проверить правила, роль пользователя |
| `The query requires an index` | Нет индекса Firestore | Перейти по ссылке из ошибки, создать индекс |
| `Firebase: Error (auth/popup-blocked)` | Браузер блокирует popup | Использовать `signInWithRedirect` |
| `Hydration failed` | SSR/CSR mismatch | Добавить `suppressHydrationWarning`, проверить условия рендера |
| `any type` warnings | Отсутствие типизации | Добавить интерфейсы, убрать `any` |

### Debug режим

```typescript
// Включить debug логирование
// lib/firebase.ts
import { setLogLevel } from 'firebase/firestore';
setLogLevel('debug');

// В AuthContext добавить логи
console.log('Auth state:', user, role);
```

### Проверка здоровья приложения

```bash
# Проверка зависимостей
npm ls --depth=0

# Проверка переменных окружения
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID

# Тест Firestore подключения
# Открыть DevTools → Console, проверить ошибки Firebase
```

### Performance Issues

```typescript
// Проблема: Много ре-рендеров
// Решение: useCallback, useMemo, React.memo

const memoizedValue = useMemo(() => {
  // Тяжёлое вычисление
}, [dependencies]);

const memoizedCallback = useCallback(() => {
  // Функция
}, [dependencies]);
```

---

## 🤝 Вклад в проект

### Code Style

```typescript
// ✅ TypeScript: строгие типы
interface Order {
  id: string;
  status: OrderStatus;
  createdAt: string;
}

// ✅ Компоненты: функциональные с хуками
export default function OrderList({ orders }: OrderListProps) {
  // Логика
  return <div>...</div>;
}

// ✅ Firebase: серверная фильтрация
const q = query(
  collection(db, 'orders'),
  where('status', '==', 'Оформлен'),
  orderBy('createdAt', 'desc'),
  limit(20)
);

// ❌ Избегать: client-side фильтрация больших данных
const orders = await getDocs(collection(db, 'orders'));
const filtered = orders.filter(o => o.status === 'Оформлен'); // Плохо!
```

### Pull Request Checklist

- [ ] TypeScript компилируется без ошибок
- [ ] Нет `any` типов в новом коде
- [ ] Добавлены необходимые Firestore индексы
- [ ] Протестировано на разных ролях (admin/employee)
- [ ] Проверена работа в dark mode
- [ ] Обновлена документация при необходимости

### Ветвление

```
main              # Продакшен версия
develop           # Разработка
feature/*         # Новые функции
fix/*             # Исправления багов
hotfix/*          # Срочные исправления prod
```

### Contact & Support

- **Технический лидер**: maximtyrsa89@gmail.com
- **Документация**: Этот README.md
- **Issues**: GitHub Issues (если используется)

---

## 📄 Лицензия

MIT License — см. [LICENSE](LICENSE) файл.

---

## 🙏 Благодарности

- **Next.js Team** — за превосходный фреймворк
- **Firebase** — за backend-as-a-service
- **Tailwind CSS** — за utility-first подход
- **Всем контрибьюторам** — за вклад в проект

---

**WMS Pro** © 2025 Kupi-Flakon. Built with ❤️ in Moscow.
