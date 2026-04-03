// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Пути, требующие авторизации
const protectedRoutes = ['/admin', '/employee'];

// Пути, доступные только админам
const adminOnlyRoutes = ['/admin'];

// Пути, доступные только сотрудникам
const employeeOnlyRoutes = ['/employee'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Получаем роль пользователя из cookies (устанавливается при логине)
  const userRole = request.cookies.get('user_role')?.value;
  const isAuthenticated = request.cookies.get('is_authenticated')?.value === 'true';
  
  // Проверка авторизации для защищенных маршрутов
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated || !userRole) {
      // Перенаправляем на страницу логина
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Проверка доступа к админским страницам
  if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
    if (userRole !== 'admin') {
      // Если пользователь не админ, перенаправляем на главную или страницу сотрудника
      if (userRole === 'employee') {
        return NextResponse.redirect(new URL('/employee', request.url));
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Проверка доступа к страницам сотрудников
  if (employeeOnlyRoutes.some(route => pathname.startsWith(route))) {
    if (userRole !== 'employee' && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Если пользователь залогинен и пытается зайти на страницу логина
  if (pathname === '/login' && isAuthenticated) {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    } else if (userRole === 'employee') {
      return NextResponse.redirect(new URL('/employee', request.url));
    }
  }

  return NextResponse.next();
}

// Настраиваем matcher для определения маршрутов, где будет работать middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
