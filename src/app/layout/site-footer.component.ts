import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LogoComponent } from './logo.component';

@Component({
  selector: 'dc-site-footer',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  template: `
    <footer class="ftr">
      <div class="dc-container ftr__inner">
        <div>
          <dc-logo tone="dark" />
          <p class="dc-motto ftr__motto">clarity with conviction</p>
        </div>
        <nav class="ftr__links" aria-label="Footer">
          <a routerLink="/book/consultation">Book a call</a>
          <a routerLink="/book/request">Make a request</a>
          <a routerLink="/status">Check a booking</a>
          <a routerLink="/admin">Staff sign-in</a>
        </nav>
      </div>
      <div class="dc-container ftr__base">© {{ year }} Diadem Consults</div>
    </footer>
  `,
  styles: [`
    .ftr { background: var(--dc-ink); color: var(--dc-paper); padding: 56px 0 28px; --logo-size: 26px; }
    .ftr__inner { display: flex; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
    .ftr__motto { margin: 16px 0 0; font-size: 15px; }
    .ftr__links { display: grid; grid-template-columns: repeat(2, auto); gap: 10px 36px; align-content: start; }
    .ftr__links a { color: #C9D3E6; text-decoration: none; font-size: 14px; }
    .ftr__links a:hover { color: var(--dc-paper); text-decoration: underline; }
    .ftr__base {
      margin-top: 44px; padding-top: 20px; border-top: 1px solid var(--dc-line);
      font-size: 12px; color: var(--dc-mist);
    }
  `],
})
export class SiteFooterComponent {
  protected readonly year = new Date().getFullYear();
}
