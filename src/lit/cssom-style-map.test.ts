import { html, render } from 'lit';
import { describe, expect, it } from 'vitest';
import { cssomStyleMap } from './cssom-style-map';

type Styles = Parameters<typeof cssomStyleMap>[0];

const renderStyles = (container: HTMLElement, styles: Styles): HTMLElement => {
  render(html`<div style=${cssomStyleMap(styles)}></div>`, container);
  return container.firstElementChild as HTMLElement;
};

describe('cssomStyleMap', () => {
  it('sets properties and custom properties through CSSOM', () => {
    const el = renderStyles(document.createElement('div'), { opacity: '0.5', '--l-x': 3 });

    expect(el.style.opacity).toBe('0.5');
    expect(el.style.getPropertyValue('--l-x')).toBe('3');
  });

  it('skips a null or undefined value on the first render', () => {
    const el = renderStyles(document.createElement('div'), { transform: null, '--l-x': undefined });

    expect(el.style.transform).toBe('');
    expect(el.style.getPropertyValue('--l-x')).toBe('');
  });

  it('removes a property that turns null or is left out on a later render', () => {
    const container = document.createElement('div');
    renderStyles(container, { transform: 'scaleX(-1)', backgroundImage: 'url(a.png)', '--l-x': '1', '--l-y': '2' });

    const el = renderStyles(container, { transform: null, '--l-x': undefined });

    expect(el.style.transform).toBe('');
    expect(el.style.backgroundImage).toBe('');
    expect(el.style.getPropertyValue('--l-x')).toBe('');
    expect(el.style.getPropertyValue('--l-y')).toBe('');
  });

  it('sets a property again after it was removed', () => {
    const container = document.createElement('div');
    renderStyles(container, { gridColumn: '2' });
    renderStyles(container, { gridColumn: null });

    const el = renderStyles(container, { gridColumn: '3' });

    expect(el.style.gridColumn).toBe('3');
  });
});
