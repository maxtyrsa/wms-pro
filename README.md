WMS Pro is a comprehensive warehouse management system designed for efficient order processing, assembly tracking, and team performance monitoring. Built with Next.js and Firebase, it provides real-time inventory management with role-based access for administrators and employees.

## Key Features

### 👥 Role-Based Access Control
- **Admin Panel**: Complete system control, user management, analytics, and reporting
- **Employee Portal**: Order assembly, dimensions input, and personal performance tracking

### 📦 Order Management
- Create and track orders with multiple carriers (CDEK, DPD, OZON, Wildberries, etc.)
- Support for different departments (KF, MP, Pack Stage)
- Order status workflow: New → Assembly → Awaiting → Ready → Completed

### ⏱️ Assembly Timer
- Real-time assembly time tracking
- Automatic time calculation and reporting
- Performance metrics per employee

### 📊 Analytics & Reporting
- Interactive dashboards with Recharts
- Employee efficiency tracking
- JAMBS module for error tracking
- Export reports to Excel (XLSX)

### 🏢 Multi-Department Support
- Different carrier assignments per department
- Flexible workflow configuration

### 🔒 Security
- Google Authentication
- Firestore security rules
- Role-based access control
- Data validation and type safety

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore)
- **Charts**: Recharts
- **Animations**: Motion (Framer Motion)
- **Excel Export**: ExcelJS
- **Icons**: Lucide React
- **Date Handling**: date-fns
