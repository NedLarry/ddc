import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'dc-not-found-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="dc-page">
      <div class="dc-container dc-container--narrow">
        <span class="dc-eyebrow" style="color: var(--dc-muted)">404</span>
        <h1 class="dc-page-title">That page doesn't exist.</h1>
        <p class="dc-page-lede">The link may be old, or the address mistyped.</p>
        <a class="dc-btn dc-btn--primary" routerLink="/">Go to the home page</a>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
