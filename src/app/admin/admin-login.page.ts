import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { LogoComponent } from '../layout/logo.component';
import { AdminAuthService } from './admin-auth.service';

@Component({
  selector: 'dc-admin-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, LogoComponent],
  template: `
    <div class="dc-page">
      <div class="dc-container login">
        <div class="login__panel">
          <dc-logo tone="dark" class="login__logo" />
          <h1>Staff sign-in</h1>
          <p class="login__lede">Manage consultation calls and technology requests.</p>

          <form [formGroup]="form" (ngSubmit)="signIn()" novalidate>
            <label class="dc-field">
              <span>Passcode</span>
              <input type="password" formControlName="passcode" autocomplete="current-password"
                     [attr.aria-invalid]="form.controls.passcode.touched && form.controls.passcode.invalid" />
              @if (form.controls.passcode.touched && form.controls.passcode.invalid) {
                <em class="dc-field-error">Enter the staff passcode.</em>
              }
            </label>
            <button class="dc-btn dc-btn--primary dc-btn--block" type="submit" [disabled]="loading()">
              {{ loading() ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>

          @if (error(); as e) { <p class="dc-alert dc-alert--error" role="alert">{{ e }}</p> }

          @if (mockPasscode) {
            <p class="login__demo">
              Demo mode: the mock API accepts <code>{{ mockPasscode }}</code>.
            </p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login { display: grid; place-items: center; }
    .login__panel {
      width: 100%; max-width: 420px; background: var(--dc-ink); color: var(--dc-paper);
      padding: 40px 36px; --logo-size: 28px;
    }
    .login__logo { margin-bottom: 32px; }
    .login__panel h1 { font-size: 26px; }
    .login__lede { color: var(--dc-mist); margin: 8px 0 28px; font-size: 15px; }
    .login__panel .dc-field > span { color: var(--dc-paper); }
    .login__panel .dc-field input { border-color: #2A3140; }
    .login__panel .dc-field-error { color: #F4A79D; }
    .login__demo {
      margin: 24px 0 0; padding-top: 18px; border-top: 1px solid var(--dc-line);
      font-size: 13px; color: var(--dc-mist);
    }
    .login__demo code { color: var(--dc-paper); font-family: var(--dc-font-ui); font-variant-numeric: tabular-nums; }
    @media (max-width: 600px) { .login__panel { padding: 32px 22px; } }
  `],
})
export class AdminLoginPage {
  /** Where to return after sign-in (from `?next=`). */
  readonly next = input<string>();

  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mockPasscode = environment.useMockApi ? environment.mockAdminPasscode : null;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    passcode: ['', Validators.required],
  });

  protected signIn(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth
      .signIn(this.form.getRawValue().passcode)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          // Only follow in-app admin paths, never an arbitrary URL.
          const next = this.next();
          const target = next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';
          void this.router.navigateByUrl(target);
        },
        error: (e: HttpErrorResponse) =>
          this.error.set(e.status === 401 ? 'That passcode is not right.' : 'Could not sign in. Try again shortly.'),
      });
  }
}
