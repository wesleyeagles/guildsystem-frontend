import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type Team = {
  id: number;
  name: string;
  uor: number;
  createdAt?: string;
  updatedAt?: string;
};

@Injectable({ providedIn: 'root' })
export class TeamsApi {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Team[]>(`${environment.apiUrl}/teams`);
  }
}
