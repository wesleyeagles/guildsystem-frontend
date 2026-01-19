import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type ItemType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  schema: any | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateItemTypePayload = {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  schema?: any;
};

export type UpdateItemTypePayload = Partial<CreateItemTypePayload>;

@Injectable({ providedIn: 'root' })
export class ItemTypesApi {
  private http = inject(HttpClient);

  listActive() {
    return this.http.get<ItemType[]>(`${environment.apiUrl}/item-types`);
  }

  listAll() {
    return this.http.get<ItemType[]>(`${environment.apiUrl}/item-types/all`);
  }

  create(payload: CreateItemTypePayload) {
    return this.http.post<ItemType>(`${environment.apiUrl}/item-types`, payload);
  }

  update(id: number, payload: UpdateItemTypePayload) {
    return this.http.patch<ItemType>(`${environment.apiUrl}/item-types/${id}`, payload);
  }

  remove(id: number) {
    return this.http.delete<{ ok: true }>(`${environment.apiUrl}/item-types/${id}`);
  }
}
