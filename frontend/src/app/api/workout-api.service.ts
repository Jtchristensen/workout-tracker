import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Workout {
  id: number;
  workout_date: string; // YYYY-MM-DD
  activity: string;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkoutCreate {
  workout_date: string;
  activity: string;
  duration_minutes?: number | null;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkoutApiService {
  private readonly baseUrl = '/api';

  constructor(private http: HttpClient) {}

  listWorkouts(
    filters?: { from?: string; to?: string },
    paging?: { limit?: number; offset?: number }
  ): Observable<Workout[]> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (paging?.limit != null) params = params.set('limit', String(paging.limit));
    if (paging?.offset != null) params = params.set('offset', String(paging.offset));
    return this.http.get<Workout[]>(`${this.baseUrl}/workouts`, { params });
  }

  countWorkouts(filters?: { from?: string; to?: string }): Observable<{ count: number }> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    return this.http.get<{ count: number }>(`${this.baseUrl}/workouts/count`, { params });
  }

  getWorkout(id: number): Observable<Workout> {
    return this.http.get<Workout>(`${this.baseUrl}/workouts/${id}`);
  }

  createWorkout(payload: WorkoutCreate): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/workouts`, payload);
  }

  updateWorkout(id: number, payload: Partial<WorkoutCreate>): Observable<Workout> {
    return this.http.put<Workout>(`${this.baseUrl}/workouts/${id}`, payload);
  }

  deleteWorkout(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/workouts/${id}`);
  }
}
