import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl.replace(/\/+$/, ''),
});

export const WS_URL = new InjectionToken<string>('WS_URL', {
  providedIn: 'root',
  factory: () => environment.wsUrl.replace(/\/+$/, ''),
});
