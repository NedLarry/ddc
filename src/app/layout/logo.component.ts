import { Component, input } from '@angular/core';

/**
 * The Crown Grid lockup: three ascending bars plus the two-line wordmark.
 *
 * Bar geometry matches diadem-consults-brand/icons/icon-dark.svg. On light
 * surfaces the white bar becomes Ink so the mark keeps its shape.
 */
@Component({
  selector: 'dc-logo',
  standalone: true,
  template: `
    <svg class="mark" viewBox="0 0 63 60" aria-hidden="true">
      <rect x="0" y="0" width="17" height="60" fill="#0F2A5C" />
      <rect x="23" y="13" width="17" height="47" fill="#2F6FED" />
      <rect x="46" y="0" width="17" height="60" [attr.fill]="tone() === 'dark' ? '#FFFFFF' : '#0A0A0B'" />
    </svg>
    @if (!markOnly()) {
      <span class="wm"><b>diadem</b><span>consults</span></span>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 12px; }
    .mark { width: auto; height: var(--logo-size, 30px); }
    .wm {
      display: flex; flex-direction: column;
      font-size: calc(var(--logo-size, 30px) * .52); line-height: 1.02; letter-spacing: -.3px;
    }
    .wm b { font-weight: bold; }
    .wm span { color: var(--dc-blue); }
  `],
})
export class LogoComponent {
  /** Surface the logo sits on. */
  readonly tone = input<'dark' | 'light'>('dark');
  /** Icon alone — the brand guide asks for this below 120px wide. */
  readonly markOnly = input(false);
}
