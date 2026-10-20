import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteFooterComponent } from './layout/site-footer.component';
import { SiteHeaderComponent } from './layout/site-header.component';

@Component({
  selector: 'dc-root',
  standalone: true,
  imports: [RouterOutlet, SiteHeaderComponent, SiteFooterComponent],
  template: `
    <a class="skip" href="#main">Skip to content</a>
    <dc-site-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <dc-site-footer />
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    main { flex: 1; outline: none; }
    .skip {
      position: absolute; left: 16px; top: -60px; z-index: 10;
      padding: 10px 14px; background: var(--dc-paper); color: var(--dc-ink);
    }
    .skip:focus { top: 12px; }
  `],
})
export class AppComponent {}
