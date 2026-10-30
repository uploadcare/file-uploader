import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { afterEach, describe, expect, it } from 'vitest';
import { LightDomMixin } from './LightDomMixin';

class DefaultSlotHost extends LightDomMixin(LitElement) {
  public override render() {
    return html`<div class="wrap">${this.yield('', html`<i class="fallback"></i>`)}</div>`;
  }
}
customElements.define('uc-test-light-default', DefaultSlotHost);

class NamedSlotsHost extends LightDomMixin(LitElement) {
  public override render() {
    return html`<div class="head">${this.yield('head')}</div>
      <div class="body">${this.yield('body', html`<i class="fallback"></i>`)}</div>`;
  }
}
customElements.define('uc-test-light-named', NamedSlotsHost);

class LateYieldHost extends LightDomMixin(LitElement) {
  @property({ type: Boolean }) public open = false;

  public override render() {
    return html`<b class="own"></b>${this.open ? html`<div class="wrap">${this.yield('')}</div>` : ''}`;
  }
}
customElements.define('uc-test-light-late', LateYieldHost);

const mounted: HTMLElement[] = [];

const mount = async <T extends LitElement>(tag: string, inner: string): Promise<T> => {
  const el = document.createElement(tag) as T;
  el.innerHTML = inner;
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

describe('LightDomMixin', () => {
  it('renders into the light DOM', async () => {
    const el = await mount<DefaultSlotHost>('uc-test-light-default', '');
    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector(':scope > .wrap')).not.toBeNull();
  });

  it('moves the original children into the default slot', async () => {
    const el = await mount<DefaultSlotHost>('uc-test-light-default', '<span class="a"></span>text');
    const wrap = el.querySelector('.wrap')!;
    expect(wrap.querySelector('.a')).not.toBeNull();
    expect(wrap.textContent).toContain('text');
    expect(wrap.querySelector('.fallback')).toBeNull();
  });

  it('renders the default content when the slot holds only comments and whitespace', async () => {
    const el = await mount<DefaultSlotHost>('uc-test-light-default', '  <!-- note -->\n  ');
    expect(el.querySelector('.wrap .fallback')).not.toBeNull();
  });

  it('renders the default content when there are no children', async () => {
    const el = await mount<DefaultSlotHost>('uc-test-light-default', '');
    expect(el.querySelector('.wrap .fallback')).not.toBeNull();
  });

  it('routes children by content-for and strips the attribute', async () => {
    const el = await mount<NamedSlotsHost>(
      'uc-test-light-named',
      '<span content-for="body" class="b"></span><span content-for="head" slot="x" class="h"></span>',
    );
    const head = el.querySelector('.head .h')!;
    expect(head).not.toBeNull();
    expect(el.querySelector('.body .b')).not.toBeNull();
    expect(el.querySelector('.body .fallback')).toBeNull();
    expect(head.hasAttribute('content-for')).toBe(false);
    expect(head.hasAttribute('slot')).toBe(false);
  });

  it('sends a comment to the slot of the element right after it', async () => {
    const el = await mount<NamedSlotsHost>(
      'uc-test-light-named',
      '<!--ng--><span content-for="head" class="h"></span>',
    );
    const head = el.querySelector('.head')!;
    expect(Array.from(head.childNodes).some((node) => node instanceof Comment && node.data === 'ng')).toBe(true);
  });

  it('adopts children added after connect but before the first update', async () => {
    const el = document.createElement('uc-test-light-default') as DefaultSlotHost;
    document.body.append(el);
    mounted.push(el);
    el.append(Object.assign(document.createElement('span'), { className: 'late' }));
    await el.updateComplete;
    expect(el.querySelector('.wrap .late')).not.toBeNull();
  });

  it('yields the original children, not its own output, when the first yield comes in a later render', async () => {
    const el = await mount<LateYieldHost>('uc-test-light-late', '<span class="a"></span>');
    el.open = true;
    await el.updateComplete;
    const wrap = el.querySelector('.wrap')!;
    expect(wrap.querySelector('.a')).not.toBeNull();
    expect(wrap.querySelector('.own')).toBeNull();
    expect(el.querySelector(':scope > .own')).not.toBeNull();
  });
});
