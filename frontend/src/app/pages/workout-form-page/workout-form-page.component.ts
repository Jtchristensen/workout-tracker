import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { WorkoutApiService } from '../../api/workout-api.service';

@Component({
  selector: 'app-workout-form-page',
  standalone: true,
  imports: [NgIf, RouterLink, ReactiveFormsModule],
  templateUrl: './workout-form-page.component.html',
  styleUrl: './workout-form-page.component.scss',
})
export class WorkoutFormPageComponent {
  private api = inject(WorkoutApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  workoutId: number | null = null;
  loading = false;

  form = this.fb.group({
    workout_date: ['', [Validators.required]],
    activity: ['', [Validators.required, Validators.maxLength(120)]],
    duration_minutes: [null as number | null],
    notes: [''],
  });

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      // default to today
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      this.form.patchValue({ workout_date: `${yyyy}-${mm}-${dd}` });
      return;
    }

    this.workoutId = Number(idParam);
    this.loading = true;
    this.api.getWorkout(this.workoutId).subscribe({
      next: (w) => {
        this.form.patchValue({
          workout_date: w.workout_date,
          activity: w.activity,
          duration_minutes: w.duration_minutes,
          notes: w.notes ?? '',
        });
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        alert(err?.error?.error || 'Failed to load workout');
      },
    });
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      workout_date: value.workout_date!,
      activity: value.activity!.trim(),
      duration_minutes: value.duration_minutes,
      notes: value.notes?.trim() || null,
    };

    this.loading = true;

    const req$ = this.workoutId
      ? this.api.updateWorkout(this.workoutId, payload)
      : this.api.createWorkout(payload);

    req$.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/workouts');
      },
      error: (err) => {
        this.loading = false;
        alert(err?.error?.error || 'Save failed');
      },
    });
  }
}
