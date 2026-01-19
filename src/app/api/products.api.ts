import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type Product = {
  id: number;
  name: string;
  ansibleName: string;
  companyId: number;
  teamId: number;
  createdAt: string;
  updatedAt: string;
  company?: { id: number; name: string };
  team?: { id: number; name: string; uor: number };
};

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Product[]>(`${environment.apiUrl}/products`);
  }
}
