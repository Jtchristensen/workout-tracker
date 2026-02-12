import { Routes } from '@angular/router';

import { WorkoutListPageComponent } from './pages/workout-list-page/workout-list-page.component';
import { WorkoutFormPageComponent } from './pages/workout-form-page/workout-form-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'workouts' },
  { path: 'workouts', component: WorkoutListPageComponent },
  { path: 'workouts/new', component: WorkoutFormPageComponent },
  { path: 'workouts/:id/edit', component: WorkoutFormPageComponent },
  { path: '**', redirectTo: 'workouts' },
];
