import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type HelmetEffect = {
  effect: string;
  value: number;
  typeNum: 'Increase' | 'Decrease';
};

export type Helmet = {
  id: number;
  code: string;
  name: string;
  imagePath: string;

  grade: { id: number; name: string };
  level: number;

  effects: HelmetEffect[];

  defense: number;
  defenseSuccesRate: number;
};

@Injectable({ providedIn: 'root' })
export class HelmetsApi {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Helmet[]>(`${API_BASE}/helmet`);
  }

  importAll() {
    return this.http.post(`${API_BASE}/helmet/import`, {});
  }
}
