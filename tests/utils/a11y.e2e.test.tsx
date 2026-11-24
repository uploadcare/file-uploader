import { describe, expect, it, onTestFinished } from 'vitest';
import { expectNoA11yViolations } from './a11y';

const mount = () => {
  const host = document.createElement('div');
  host.innerHTML = '<p>Text</p><span class="spinner"></span>';
  document.body.append(host);
  onTestFinished(() => host.remove());
  return host;
};

describe('expectNoA11yViolations', () => {
  it('does not wait for an infinite animation, nor one outside the scanned element', async () => {
    const host = mount();
    host.querySelector('.spinner')!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, iterations: Infinity });
    const elsewhere = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => elsewhere.remove());
    elsewhere.animate([{ opacity: 0 }, { opacity: 1 }], 60_000);

    await expectNoA11yViolations(host);
  });

  it('waits for an animation on the scanned element, and survives one cancelled meanwhile', async () => {
    const host = mount();
    const fade = host.animate([{ opacity: 0 }, { opacity: 1 }], 200);
    const cancelled = host.querySelector('p')!.animate([{ opacity: 0 }, { opacity: 1 }], 60_000);
    setTimeout(() => cancelled.cancel(), 50);

    await expectNoA11yViolations(host);
    expect(fade.playState).toBe('finished');
  });
});
