<div align="center">
  <img width="1200" height="475" alt="WMS Pro Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  <br/>
  <h1>WMS Pro - Warehouse Management System</h1>
  <p>Professional warehouse management solution for efficient order processing and team performance tracking</p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Firebase](https://img.shields.io/badge/Firebase-12.10-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
</div>

## 📋 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Firebase Setup](#-firebase-setup)
- [User Roles](#-user-roles)
- [Workflow](#-workflow)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### For Administrators
- 📊 **Real-time Dashboard** with interactive charts and KPIs
- 👥 **User Management** - Add/edit/remove employees and admins
- 📦 **Order Management** - Full control over all orders with bulk operations
- 📈 **Performance Analytics** - Track employee efficiency and assembly times
- 🐛 **JAMBS Module** - Log and track employee errors with severity levels
- 📑 **Excel Reports** - Export comprehensive order reports
- 🔐 **Role Management** - Granular access control

### For Employees
- ⚡ **Quick Order Creation** - Simple form with department-based carrier selection
- ⏱️ **Assembly Timer** - Track assembly time with real-time counter
- 📏 **Dimensions Input** - Enter package dimensions with group editing
- 📋 **Order History** - View personal order history and performance
- 📱 **Mobile Responsive** - Full functionality on mobile devices

### Order Status Workflow

New → Assembly (with timer) → Awaiting Registration → Ready for Pickup → Completed
↓
Dimensions Input
↓
Awaiting Registration (for courier orders)


## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.4 | React framework with SSR |
| React | 19.2 | UI library |
| TypeScript | 5.9 | Type safety |
| Tailwind CSS | 4.1 | Styling |
| Firebase Auth | 12.10 | Authentication |
| Firestore | 12.10 | Real-time database |
| Recharts | 3.8 | Charts and graphs |
| Motion | 12.38 | Animations |
| ExcelJS | 4.4 | Excel export |
| date-fns | 4.1 | Date manipulation |
| Lucide React | 0.553 | Icons |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase account
- Google Cloud Console project

### Installation

1. **Clone the repository**
  
```bash
git clone https://github.com/yourusername/wms-pro.git
cd wms-pro
```

2. **Install dependencies**

 ```bash
npm install
# or
yarn install
```

3. **Configure environment variables**

 ```bash
cp .env.example .env.local
```
Edit .env.local with your values:

 ```bash
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPER_ADMIN_EMAIL="admin@example.com"
```

4. **Set up Firebase**

Create a project in Firebase Console

Enable Authentication (Google Sign-in)

Create Firestore database

Copy Firebase config to firebase-applet-config.json

5. **Run the development server**

 ```bash
npm run dev
# or
yarn dev
```

6. **Open your browser**
Navigate to http://localhost:3000



