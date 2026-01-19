import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type ShieldEffect = {
  effect: string;
  value: number;
  typeNum: 'Increase' | 'Decrease';
};

export type ShieldApi = {
  id: number;
  code: string;
  name: string;
  imagePath: string;

  grade: { id: number; name: string };
  level: number;

  effects: ShieldEffect[];
  defense: number;

};

@Injectable({ providedIn: 'root' })
export class ShieldsApi {
  private http = inject(HttpClient);

  list() {
    return this.http.get<ShieldApi[]>(`${API_BASE}/shield`);
  }

  importAll() {
    return this.http.post(`${API_BASE}/shield/import`, {});
  }
}
