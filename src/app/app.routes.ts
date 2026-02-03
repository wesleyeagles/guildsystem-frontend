import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { guestGuard } from './auth/guest.guard';
import { adminGuard } from './auth/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'waiting-acceptance',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/waiting-acceptance/waiting-acceptance.page').then((m) => m.WaitingAcceptancePage),
  },
  {
    path: 'auth/discord',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/discord/auth-discord.page').then((m) => m.AuthDiscordPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'events',
        loadComponent: () => import('./pages/events/events-public/events-public.page').then((m) => m.EventsPublicPage),
      },
      {
        path: 'auctions',
        loadComponent: () =>
          import('./pages/auctions/auctions-public/auctions-public.page').then((m) => m.AuctionsPublicPage),
      },
      {
        path: 'auctions/admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/auctions/auctions-admin/auctions-admin.page').then((m) => m.AuctionsAdminPage),
      },
      {
        path: 'members/admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin/pending-members.page').then((m) => m.PendingMembersPage),
      },
      {
        path: 'members/permissions',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin/permissions/permissions.page').then((m) => m.PermissionsPage),
      },
      {
        path: 'members/:id',
        loadComponent: () => import('./pages/members/member-details/member-details.page').then((m) => m.MemberDetailsPage),
      },
      {
        path: 'events/admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/events/events-admin/events-admin.page').then((m) => m.EventsAdminPage),
      },
      {
        path: 'forces',
        loadComponent: () => import('./pages/casts/casts.page').then((m) => m.CastsPage),
      },
      {
        path: 'weapons',
        loadComponent: () => import('./pages/weapons/weapons.page').then((m) => m.WeaponsPage),
      },
      {
        path: 'armor/:slot',
        loadComponent: () => import('./pages/armor/armor.page').then((m) => m.ArmorPage),
      },
      {
        path: 'accessories/:slot',
        loadComponent: () => import('./pages/accessories/accessories.page').then((m) => m.AccessoriesPage),
      },
      {
        path: 'shields',
        loadComponent: () => import('./pages/shields/shields.page').then((m) => m.ShieldsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
