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

  private refresh$ = new BehaviorSubject<void>(undefined);

  workouts$ = combineLatest([this.refresh$]).pipe(
    switchMap(() => this.api.listWorkouts()),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // Calendar
  private monthOffset$ = new BehaviorSubject<number>(0);

  monthLabel$ = this.monthOffset$.pipe(
    map((off) => {
      const base = new Date();
      const m = new Date(base.getFullYear(), base.getMonth() + off, 1);
      return m.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    })
  );

  calendarDays$ = combineLatest([this.monthOffset$, this.workouts$]).pipe(
    map(([off, workouts]) => {
      const base = new Date();
      const monthStart = new Date(base.getFullYear(), base.getMonth() + off, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

      const firstDow = monthStart.getDay(); // 0 Sun
      const gridStart = new Date(monthStart);
      gridStart.setDate(monthStart.getDate() - firstDow);

      const workoutDates = new Set(workouts.map((w) => w.workout_date));

      const days: Array<{ date: Date; ymd: string; inMonth: boolean; workedOut: boolean }> = [];
      const totalCells = 42; // 6 weeks
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

      return {
        monthStart,
        monthEnd,
        days,
      };
    })
  );

  prevMonth() {
    this.monthOffset$.next(this.monthOffset$.value - 1);
  }

  nextMonth() {
    this.monthOffset$.next(this.monthOffset$.value + 1);
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
