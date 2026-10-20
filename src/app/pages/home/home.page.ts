import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'dc-home-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="dc-container hero__inner">
        <div class="hero__copy">
          <span class="dc-eyebrow">Technology consulting</span>
          <h1 class="hero__title">Clear answers to hard technology decisions.</h1>
          <p class="dc-motto hero__motto">clarity with conviction</p>
          <p class="hero__lede">
            Talk a problem through with us on a call, or send over a piece of work you
            need scoped or built. Either way you'll hear back within one business day.
          </p>
          <div class="hero__actions">
            <a routerLink="/book/consultation" class="dc-btn dc-btn--primary">Book a consultation call</a>
            <a routerLink="/book/request" class="dc-btn dc-btn--ghost">Make a technology request</a>
          </div>
        </div>
        <div class="hero__art" aria-hidden="true">
          <i></i><i></i><i></i>
        </div>
      </div>
      <a class="hero__cue" routerLink="/" fragment="services">
        <span>Scroll</span>
        <i aria-hidden="true"></i>
      </a>
    </section>

    <section class="ways" id="services">
      <div class="dc-container">
        <span class="dc-eyebrow dc-eyebrow--dark">Two ways to start</span>
        <h2 class="section-title">Pick whichever fits where you are.</h2>

        <div class="ways__grid">
          <article class="dc-card way">
            <h3>Consultation call</h3>
            <p class="way__meta">30 minutes · individuals and businesses</p>
            <p>
              For when you have a decision to make — a build-or-buy question, a stalled
              project, an architecture you're unsure about. Choose a time that suits you,
              and we'll come prepared.
            </p>
            <ul>
              <li>Pick a slot from the live calendar</li>
              <li>Times shown in your own timezone</li>
              <li>Confirmation by email</li>
            </ul>
            <a routerLink="/book/consultation" class="dc-btn dc-btn--dark">Choose a time</a>
          </article>

          <article class="dc-card way">
            <h3>Technology request</h3>
            <p class="way__meta">Scoped reply within one business day</p>
            <p>
              For when you already know what you need — a migration, an integration, an
              audit, a new feature. Describe it in a few sentences and we'll reply with
              questions, an approach, or a quote.
            </p>
            <ul>
              <li>No call needed to get started</li>
              <li>Tracked with a booking reference</li>
              <li>Check progress any time</li>
            </ul>
            <a routerLink="/book/request" class="dc-btn dc-btn--dark">Describe your request</a>
          </article>
        </div>
      </div>
    </section>

    <section class="steps">
      <div class="dc-container">
        <span class="dc-eyebrow dc-eyebrow--dark">How it works</span>
        <ol class="steps__list">
          <li>
            <b>Tell us what you need</b>
            <span>Book a call or describe your request. It takes about two minutes.</span>
          </li>
          <li>
            <b>Get a reference</b>
            <span>You'll receive a reference like DC-8F2K1A to track your booking.</span>
          </li>
          <li>
            <b>Hear back within a day</b>
            <span>We confirm the call or reply to the request within one business day.</span>
          </li>
        </ol>
      </div>
    </section>

    <section class="band">
      <div class="dc-container band__inner">
        <div>
          <h2 class="band__title">Already booked?</h2>
          <p>Use your reference and email to see where things stand.</p>
        </div>
        <a routerLink="/status" class="dc-btn dc-btn--ghost">Check a booking</a>
      </div>
    </section>
  `,
  styles: [`
    /* The hero fills the first screen below the header, so the white
       sections only appear once the visitor scrolls. */
    .hero {
      position: relative; display: flex; flex-direction: column;
      min-height: calc(100vh - var(--dc-header-h));
      min-height: calc(100svh - var(--dc-header-h));
      background: var(--dc-ink); color: var(--dc-paper); overflow: hidden;
    }
    .hero__inner {
      flex: 1;
      display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      align-items: center; gap: 48px; padding-top: 64px; padding-bottom: 96px;
    }
    .hero__cue {
      position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      color: var(--dc-mist); text-decoration: none;
      font-size: 10px; letter-spacing: var(--dc-track-eyebrow); text-transform: uppercase;
    }
    .hero__cue i { display: block; width: 1px; height: 36px; background: linear-gradient(var(--dc-mist), transparent); }
    .hero__cue:hover { color: var(--dc-paper); }
    @media (max-height: 560px) { .hero__cue { display: none; } }
    .hero__title { font-size: clamp(34px, 5.4vw, 60px); max-width: 16ch; }
    .hero__motto { font-size: 20px; margin: 20px 0 0; }
    .hero__lede { color: #C9D3E6; max-width: 52ch; margin: 22px 0 34px; font-size: 17px; }
    .hero__actions { display: flex; flex-wrap: wrap; gap: 12px; }
    .hero__actions .dc-btn--ghost { color: var(--dc-paper); border-color: rgba(255,255,255,.4); }

    .hero__art { display: flex; align-items: flex-start; justify-content: center; gap: 22px; height: 300px; }
    .hero__art i { display: block; width: 72px; height: 100%; background: var(--dc-navy); }
    .hero__art i:nth-child(2) {
      height: 78%; align-self: flex-end;
      background: transparent; border: 1px solid var(--dc-mist);
    }
    .hero__art i:nth-child(3) { background: var(--dc-paper); }

    .dc-eyebrow--dark { color: var(--dc-muted); }
    .section-title { font-size: clamp(26px, 3.4vw, 36px); margin-bottom: 36px; max-width: 22ch; }

    .ways { padding: 96px 0; }
    .ways__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
    .way { display: flex; flex-direction: column; align-items: flex-start; }
    .way h3 { font-size: 24px; }
    .way__meta { margin: 6px 0 16px; font-size: 13px; color: var(--dc-muted); }
    .way p { margin-top: 0; }
    .way ul { margin: 0 0 28px; padding-left: 18px; color: var(--dc-muted); font-size: 15px; }
    .way li + li { margin-top: 4px; }
    .way .dc-btn { margin-top: auto; }

    .steps { padding: 0 0 96px; }
    .steps__list {
      list-style: none; margin: 0; padding: 0; counter-reset: step;
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px;
      background: var(--dc-line-light); border: 1px solid var(--dc-line-light);
    }
    .steps__list li {
      counter-increment: step; background: var(--dc-paper); padding: 28px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .steps__list li::before {
      content: '0' counter(step); font-size: 12px; letter-spacing: 3px; color: var(--dc-mist);
    }
    .steps__list b { font-size: 18px; }
    .steps__list span { color: var(--dc-muted); font-size: 15px; }

    .band { background: var(--dc-navy); color: var(--dc-paper); padding: 56px 0; }
    .band__inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
    .band__title { font-size: 26px; }
    .band p { margin: 8px 0 0; color: #C9D3E6; }
    .band .dc-btn--ghost { color: var(--dc-paper); border-color: rgba(255,255,255,.5); }

    @media (max-width: 860px) {
      .hero__inner { grid-template-columns: 1fr; padding-top: 48px; padding-bottom: 96px; }
      .hero__art { display: none; }
      .ways { padding: 64px 0; }
      .ways__grid, .steps__list { grid-template-columns: 1fr; }
      .steps { padding-bottom: 64px; }
    }
  `],
})
export class HomePage {}
