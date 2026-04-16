# WMS Pro — Context for AI Assistant

## Project Overview

**WMS Pro** is a comprehensive Warehouse Management System for "Kupi-Flakon" (Moscow-based warehouse). It provides order management, consolidation, shipping, returns tracking, and analytics capabilities with role-based access control.

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.9 (strict mode disabled, but strict typing preferred)
- **UI**: React 19 with Server Components
- **Styling**: Tailwind CSS 4.1
- **Database**: Firebase Firestore (with offline persistence)
- **Authentication**: Firebase Auth (Google + Email/Password)
- **Charts**: Recharts 3.8
- **Excel Export**: ExcelJS 4.4
- **Animations**: Motion (Framer Motion) 12.23
- **Icons**: Lucide React
- **Date Handling**: date-fns 4.1

### Project Structure

```
/home/user/wms-pro/
├── app/                          # Next.js App Router (pages & layouts)
│   ├── admin/                    # Admin panel (requires admin role)
│   │   ├── consolidations/       # Consolidation management
│   │   ├── dashboard/            # Analytics & KPI dashboard
│   │   ├── jambs/                # Error/incident tracking
│   │   ├── orders/               # Order management (main CRUD)
│   │   ├── pickup_orders/        # Pickup order management
│   │   ├── reports/              # Excel report exports
│   │   ├── returns/              # Returns history
│   │   ├── shipments/            # Shipment consolidation
│   │   └── users/                # User management
│   ├── employee/                 # Employee portal (requires employee role)
│   │   ├── add_dimensions/       # Add order dimensions
│   │   ├── add_money/            # Financial data entry
│   │   ├── add_order/            # Create new orders
│   │   ├── assembly/             # Order assembly workflow
│   │   ├── edit_order/           # Edit existing orders
│   │   ├── order_details/        # Order detail view
│   │   ├── orders_by_date/       # Daily order view
│   │   └── pickup_orders/        # Pickup order handling
│   ├── login/                    # Authentication page
│   ├── globals.css               # Global styles (Tailwind)
│   ├── layout.tsx                # Root layout (providers wrapper)
│   └── page.tsx                  # Home page (redirects based on role)
├── components/                   # Reusable React components
│   ├── consolidation/            # Consolidation modals
│   ├── orders/                   # Order list components
│   ├── print/                    # Print functionality
│   ├── returns/                  # Return management
│   ├── shipments/                # Shipment lists
│   ├── ui/                       # UI primitives
│   ├── ErrorBoundary.tsx         # Error boundary wrapper
│   └── Toast.tsx                 # Toast notification system
├── context/                      # React Context providers
│   ├── AuthContext.tsx           # Firebase auth + role management
│   └── ThemeContext.tsx          # Dark/light theme toggle
├── hooks/                        # Custom React hooks
│   ├── use-mobile.ts             # Mobile device detection
│   └── usePaginatedOrders.ts     # Order pagination logic
├── lib/                          # Business logic & utilities
│   ├── constants.ts              # App constants (statuses, colors)
│   ├── dateUtils.ts              # Date formatting utilities
│   ├── firebase.ts               # Firebase initialization
│   ├── orders.ts                 # Order service functions
│   └── utils.ts                  # General utilities
├── types/                        # TypeScript type definitions
│   └── order.ts                  # Order interface
├── middleware.ts                 # Next.js middleware (route protection)
├── firebase.json                 # Firebase hosting config
├── firestore.rules               # Firestore security rules
├── firestore.indexes.json        # Firestore composite indexes
└── Configuration files
    ├── .env.example              # Environment variable template
    ├── next.config.ts            # Next.js configuration
    ├── tsconfig.json             # TypeScript configuration
    ├── eslint.config.mjs         # ESLint configuration
    └── package.json              # Dependencies & scripts
```

## Building and Running

### Prerequisites

- Node.js >= 20.x
- Firebase project with Auth + Firestore enabled
- Environment variables configured (see `.env.example`)

### Development

```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run lint         # Run ESLint with auto-fix
npm run clean        # Clean Next.js build cache
```

### Production

```bash
npm run build        # Build for production
npm run start        # Start production server
```

### Type Checking

```bash
npx tsc --noEmit     # Check TypeScript types (doesn't emit files)
```

Note: TypeScript strict mode is disabled (`"strict": false` in tsconfig.json), but the codebase prefers strict typing. Avoid `any` types in new code.

## Key Architectural Patterns

### Authentication & Authorization

The app uses Firebase Auth with role-based access control:

1. **Auth Flow**: Users authenticate via Google (popup/redirect) or email/password
2. **Role Check**: User document in Firestore (`users/{email}`) contains role field
3. **Middleware**: `middleware.ts` checks cookies (`user_role`, `is_authenticated`) for route protection
4. **Cookies**: Set client-side in `AuthContext` after successful authentication
5. **Super Admin**: Email in `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` auto-gets admin role

**Roles:**
- **Admin**: Full access to all admin routes (`/admin/*`)
- **Employee**: Limited access to employee routes (`/employee/*`)

### Data Layer

- **Firebase Firestore**: Primary database with real-time listeners (`onSnapshot`)
- **Offline Support**: Enabled via `persistentLocalCache` with multi-tab support
- **Pagination**: Server-side using `startAfter` with `limit(20)` page size
- **Query Patterns**: Prefer server-side filtering over client-side filtering

### Component Patterns

- **Server Components**: Default; use `'use client'` directive only when needed (state, hooks, browser APIs)
- **State Management**: React Context + `useState` (no Redux/Zustand)
- **Styling**: Tailwind utility classes with dark mode support (`dark:` prefix)
- **Animations**: Framer Motion (`motion/react`) for transitions and micro-interactions
- **Icons**: Lucide React icon library

### Order Management

Orders are the core entity with these key fields:
- `orderNumber`: Human-readable order identifier
- `carrier`: Transport company (CDEK, DPD, Деловые линии, etc.)
- `status`: Order status (Новый, Комплектация, Оформлен, Отправлен, etc.)
- `createdAt`: Creation timestamp
- `shippedAt`: Shipping timestamp (set when status changes to "Отправлен")
- `places_data`: Array of place dimensions (d, w, h, weight)
- `consolidationId` / `consolidationNumber`: Link to consolidation batch

**Carrier Types:**
- ТК (Transport Companies): CDEK, DPD, Деловые линии, Почта России, ПЭК, etc.
- Самовывоз (Pickup): Self-pickup orders

**Status Workflows:**
- ТК orders: Новый → Комплектация → Ожидает оформления → Оформлен → Отправлен
- Pickup orders: Новый → Готов к выдаче → Выдан
- Returns: Запрошен возврат → Возврат одобрен/отклонен → Возврат получен

## Development Conventions

### TypeScript

- Prefer interfaces over types for object shapes
- Avoid `any` — use proper types or `unknown` with type guards
- Use discriminated unions for status/state patterns
- Leverage TypeScript's type inference where possible

### React Components

```typescript
// ✅ Preferred: Functional component with explicit props type
interface OrderCardProps {
  order: Order;
  onStatusChange: (id: string, status: string) => void;
}

export default function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const handleClick = useCallback(() => {
    onStatusChange(order.id, 'Отправлен');
  }, [order.id, onStatusChange]);

  return <div onClick={handleClick}>...</div>;
}
```

### Firebase Queries

```typescript
// ✅ Preferred: Server-side filtering with proper indexes
const q = query(
  collection(db, 'orders'),
  where('status', '==', 'Оформлен'),
  orderBy('createdAt', 'desc'),
  limit(20)
);

// ❌ Avoid: Client-side filtering of large datasets
const allOrders = await getDocs(collection(db, 'orders'));
const filtered = allOrders.filter(o => o.status === 'Оформлен');
```

### Error Handling

- Use try/catch for async operations
- Show user-friendly messages via `showToast()` from `@/components/Toast`
- Log errors to console for debugging (removed in production via `next.config.ts`)
- Use ErrorBoundary for catching render-time errors

### Naming Conventions

- **Files**: kebab-case for directories, PascalCase for components, camelCase for utilities
- **Components**: PascalCase (e.g., `ShippedOrdersList.tsx`)
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE for constants arrays/objects
- **Types/Interfaces**: PascalCase

### Database Indexes

Firestore requires composite indexes for multi-field queries. Common indexes:
- `orders: status ASC, createdAt DESC`
- `orders: carrier ASC, createdAt DESC`
- `orders: status ASC, carrier ASC, createdAt DESC`

When a query fails due to missing index, Firestore provides a link to create it in Firebase Console.

## Important Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Route protection based on user role |
| `context/AuthContext.tsx` | Auth state, role management, sign-in methods |
| `lib/firebase.ts` | Firebase app initialization (auth, firestore) |
| `lib/orders.ts` | Order CRUD operations, status transitions |
| `lib/constants.ts` | Status colors, order status definitions, return reasons |
| `types/order.ts` | TypeScript interfaces for order data |
| `firestore.rules` | Security rules for Firestore collections |
| `firestore.indexes.json` | Composite index definitions |

## Testing

No formal test framework is configured. Manual testing practices:
- Test features with both admin and employee roles
- Verify dark mode compatibility
- Test on mobile viewport sizes
- Check Firestore security rules prevent unauthorized access

## Git Workflow

- Conventional commits preferred: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Feature branches: `feature/description` or `fix/description`
- Keep commits atomic and focused

## Common Tasks

### Adding a New Carrier

Update the `CARRIERS` array in `/app/admin/orders/page.tsx`:
```typescript
const CARRIERS = ['Все', 'CDEK', 'DPD', '...', 'New Carrier'];
```

### Adding a New Status

1. Add to `TK_STATUSES` or `PICKUP_STATUSES` in `/app/admin/orders/page.tsx`
2. Update `getStatusColor()` in `lib/constants.ts`
3. Update `getAvailableStatuses()` logic if needed
4. Add to `ALL_STATUSES` for filter dropdowns

### Creating a New Admin Page

1. Create directory under `/app/admin/new-page/page.tsx`
2. Add `'use client'` if using hooks/state
3. Use `useAuth()` to check role (middleware handles route protection)
4. Follow Tailwind styling patterns with dark mode support

### Adding Firestore Collection

1. Define TypeScript interface in `/types/`
2. Create service functions in `/lib/`
3. Set up security rules in `firestore.rules`
4. Add indexes to `firestore.indexes.json` if needed
