import { Routes } from '@angular/router';

import { adminGuard } from './admin/admin.guard';

const suffix = ' · Diadem Consults';

export const routes: Routes = [
  {
    path: '',
    title: 'Diadem Consults — clarity with conviction',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  { path: 'book', pathMatch: 'full', redirectTo: 'book/consultation' },
  {
    path: 'book/consultation',
    title: 'Book a consultation call' + suffix,
    data: { kind: 'consultation' },
    loadComponent: () => import('./pages/book/book.page').then((m) => m.BookPage),
  },
  {
    path: 'book/request',
    title: 'Make a technology request' + suffix,
    data: { kind: 'request' },
    loadComponent: () => import('./pages/book/book.page').then((m) => m.BookPage),
  },
  {
    path: 'book/confirmed',
    title: 'Booking received' + suffix,
    loadComponent: () => import('./pages/confirmation/confirmation.page').then((m) => m.ConfirmationPage),
  },
  {
    path: 'status',
    title: 'Check your booking' + suffix,
    loadComponent: () => import('./pages/status/status.page').then((m) => m.StatusPage),
  },
  {
    path: 'admin/login',
    title: 'Staff sign-in' + suffix,
    loadComponent: () => import('./admin/admin-login.page').then((m) => m.AdminLoginPage),
  },
  {
    path: 'admin',
    title: 'Bookings' + suffix,
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-dashboard.page').then((m) => m.AdminDashboardPage),
  },
  {
    path: '**',
    title: 'Page not found' + suffix,
    loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage),
  },
];
