import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';

import { WorkoutApiService, Workout } from '../../api/workout-api.service';

@Component({
  selector: 'app-workout-list-page',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, DatePipe, RouterLink],
  templateUrl: './workout-list-page.component.html',
  styleUrl: './workout-list-page.component.scss',
})
export class WorkoutListPageComponent {
  private api = inject(WorkoutApiService);

  private refresh$ = new BehaviorSubject<void>(undefined);

  workouts$ = combineLatest([this.refresh$]).pipe(
    switchMap(() => this.api.listWorkouts())
  );

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
