import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { LogoComponent } from './logo.component';

@Component({
  selector: 'dc-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  template: `
    <header class="hdr">
      <div class="dc-container hdr__inner">
        <a routerLink="/" class="hdr__brand" aria-label="Diadem Consults — home">
          <dc-logo tone="dark" />
        </a>

        <button
          type="button"
          class="hdr__menu"
          [attr.aria-expanded]="open()"
          aria-controls="site-nav"
          (click)="open.set(!open())">
          <span class="dc-visually-hidden">Menu</span>
          <span class="hdr__burger" [class.is-open]="open()" aria-hidden="true"></span>
        </button>

        <nav id="site-nav" class="hdr__nav" [class.is-open]="open()" aria-label="Main">
          <a routerLink="/book/consultation" routerLinkActive="is-active">Book a call</a>
          <a routerLink="/book/request" routerLinkActive="is-active">Make a request</a>
          <a routerLink="/status" routerLinkActive="is-active">Check a booking</a>
        </nav>
      </div>
    </header>
  `,
  styles: [`
    .hdr { background: var(--dc-ink); color: var(--dc-paper); border-bottom: 1px solid var(--dc-line); }
    .hdr__inner { display: flex; align-items: center; justify-content: space-between; min-height: 72px; gap: 24px; }
    .hdr__brand { text-decoration: none; color: inherit; --logo-size: 30px; }

    .hdr__nav { display: flex; gap: 28px; }
    .hdr__nav a {
      color: #C9D3E6; text-decoration: none; font-size: 14px; padding: 6px 0;
      border-bottom: 2px solid transparent;
    }
    .hdr__nav a:hover { color: var(--dc-paper); }
    .hdr__nav a.is-active { color: var(--dc-paper); border-bottom-color: var(--dc-mist); }

    .hdr__menu { display: none; background: none; border: 0; padding: 10px; cursor: pointer; }
    .hdr__burger, .hdr__burger::before, .hdr__burger::after {
      display: block; width: 22px; height: 2px; background: var(--dc-paper); transition: transform .2s;
    }
    .hdr__burger { position: relative; }
    .hdr__burger::before, .hdr__burger::after { content: ''; position: absolute; left: 0; }
    .hdr__burger::before { top: -7px; }
    .hdr__burger::after { top: 7px; }
    .hdr__burger.is-open { background: transparent; }
    .hdr__burger.is-open::before { transform: translateY(7px) rotate(45deg); }
    .hdr__burger.is-open::after { transform: translateY(-7px) rotate(-45deg); }

    @media (max-width: 720px) {
      .hdr__inner { flex-wrap: wrap; min-height: 64px; }
      .hdr__menu { display: block; }
      .hdr__nav { display: none; width: 100%; flex-direction: column; gap: 0; padding-bottom: 12px; }
      .hdr__nav.is-open { display: flex; }
      .hdr__nav a { padding: 12px 0; border-bottom: 1px solid var(--dc-line); }
      .hdr__nav a.is-active { border-bottom-color: var(--dc-line); }
    }
  `],
})
export class SiteHeaderComponent {
  protected readonly open = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.open.set(false));
  }
}
