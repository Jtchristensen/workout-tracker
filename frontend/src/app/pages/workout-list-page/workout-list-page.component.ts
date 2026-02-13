import { Component, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, shareReplay, switchMap } from 'rxjs';

import { WorkoutApiService, Workout } from '../../api/workout-api.service';

function toYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Component({
  selector: 'app-workout-list-page',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, RouterLink],
  templateUrl: './workout-list-page.component.html',
  styleUrl: './workout-list-page.component.scss',
})
export class WorkoutListPageComponent {
  private api = inject(WorkoutApiService);

  readonly pageSize = 50;
  offset$ = new BehaviorSubject<number>(0);
  private refresh$ = new BehaviorSubject<void>(undefined);

  logWorkouts$ = combineLatest([this.offset$, this.refresh$]).pipe(
    switchMap(([offset]) => this.api.listWorkouts(undefined, { limit: this.pageSize, offset })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  totalCount$ = this.refresh$.pipe(
    switchMap(() => this.api.countWorkouts()),
    map((res) => res.count),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  totalPages$ = this.totalCount$.pipe(map((count) => Math.max(1, Math.ceil(count / this.pageSize))));
  currentPage$ = this.offset$.pipe(map((offset) => Math.floor(offset / this.pageSize) + 1));

  private monthOffset$ = new BehaviorSubject<number>(0);

  monthLabel$ = this.monthOffset$.pipe(
    map((off) => {
      const base = new Date();
      const m = new Date(base.getFullYear(), base.getMonth() + off, 1);
      return m.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    })
  );

  calendarDays$ = combineLatest([this.monthOffset$, this.refresh$]).pipe(
    switchMap(([off]) => {
      const base = new Date();
      const monthStart = new Date(base.getFullYear(), base.getMonth() + off, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const from = toYmd(monthStart);
      const to = toYmd(monthEnd);

      return this.api
        .listWorkouts({ from, to }, { limit: 500, offset: 0 })
        .pipe(map((workouts) => ({ monthStart, workouts })));
    }),
    map(({ monthStart, workouts }) => {
      const firstDow = monthStart.getDay();
      const gridStart = new Date(monthStart);
      gridStart.setDate(monthStart.getDate() - firstDow);

      const workoutDates = new Set(workouts.map((w) => w.workout_date));

      const days: Array<{ date: Date; ymd: string; inMonth: boolean; workedOut: boolean }> = [];
      const totalCells = 42;
      for (let i = 0; i < totalCells; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        const ymd = toYmd(d);
        days.push({
          date: d,
          ymd,
          inMonth: d.getMonth() === monthStart.getMonth(),
          workedOut: workoutDates.has(ymd),
        });
      }

      return { days };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  prevMonth() {
    this.monthOffset$.next(this.monthOffset$.value - 1);
  }

  nextMonth() {
    this.monthOffset$.next(this.monthOffset$.value + 1);
  }

  prevPage() {
    const nextOffset = Math.max(0, this.offset$.value - this.pageSize);
    if (nextOffset !== this.offset$.value) this.offset$.next(nextOffset);
  }

  nextPage(currentCount: number) {
    if (currentCount < this.pageSize) return;
    this.offset$.next(this.offset$.value + this.pageSize);
  }

  trackById(_: number, w: Workout) {
    return w.id;
  }

  refresh() {
    this.refresh$.next();
  }

  async deleteWorkout(w: Workout) {
    const ok = confirm(`Delete workout #${w.id} (${w.workout_date} - ${w.activity})?`);
    if (!ok) return;

    this.api.deleteWorkout(w.id).subscribe({
      next: () => this.refresh(),
      error: (err) => alert(err?.error?.error || 'Delete failed'),
    });
  }
}
