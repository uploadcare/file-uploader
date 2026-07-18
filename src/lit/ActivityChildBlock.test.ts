import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { RouterController } from '../abstract/controllers/RouterController';
import { delay } from '../utils/delay';
import { ActivityChildBlock } from './ActivityChildBlock';
import { ACTIVITY_TYPES } from './activity-constants';
import { PubSub } from './PubSubCompat';

// ─── Test-only ActivityChildBlock subclasses ─────────────────────────────────
// A background activity block (rendered inline, not inside `<uc-modal>`): its
// `[active]` tracks the router's background `activity` slot.
class BgActivityBlock extends ActivityChildBlock {
  public override activityType = ACTIVITY_TYPES.UPLOAD_LIST;
  public override render() {
    return html``;
  }
}
BgActivityBlock.reg('uc-test-bg-activity');

// A foreground activity block (rendered inside `<uc-modal>`): its `[active]`
// tracks the router's foreground `modal` slot.
class ModalActivityBlock extends ActivityChildBlock {
  public override activityType = ACTIVITY_TYPES.CAMERA;
  public override render() {
    return html``;
  }
}
ModalActivityBlock.reg('uc-test-modal-activity');

// A null-`activityType` host (e.g. a `PluginActivityHost` before its
// registration arrives): the base wires the router subscription but skips all
// activity-id-dependent work. Exposes the protected surface for direct probing.
class NullActivityBlock extends ActivityChildBlock {
  public override render() {
    return html``;
  }
  public callReport(): void {
    this.reportActivityMounted();
  }
  public get isActive(): boolean {
    return this.isActivityActive;
  }
  public get params(): unknown {
    return this.activityParams;
  }
}
NullActivityBlock.reg('uc-test-null-activity');

// ─── Harness ─────────────────────────────────────────────────────────────────
let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `activity-childblock-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

const router = (ctxName: string): RouterController => {
  const container = PubSub.getContainer(ctxName);
  if (!container) throw new Error(`no container for ctx "${ctxName}"`);
  return container.get(RouterController);
};

const flush = async (el: HTMLElement & { updateComplete: Promise<unknown> }): Promise<void> => {
  await delay(0);
  await el.updateComplete;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

describe('ActivityChildBlock [active] host attribute', () => {
  it('toggles [active] on the host when the background activity slot matches, reactively both ways', async () => {
    const ctxName = freshCtxName();
    const el = document.createElement('uc-test-bg-activity') as BgActivityBlock & { updateComplete: Promise<unknown> };
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    // Base reflects its activity type onto the host — the `[activity="…"]` half
    // of the CSS selectors (`[activity="camera"][active]`, …).
    expect(el.getAttribute('activity')).toBe(ACTIVITY_TYPES.UPLOAD_LIST);
    // Nothing navigated yet → not active.
    expect(el.hasAttribute('active')).toBe(false);

    // Background slot becomes this block's activity → [active] appears.
    router(ctxName).setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
    await flush(el);
    expect(el.hasAttribute('active')).toBe(true);

    // Background slot moves elsewhere → [active] clears (reactive, other way).
    router(ctxName).setActivity(ACTIVITY_TYPES.START_FROM);
    await flush(el);
    expect(el.hasAttribute('active')).toBe(false);
  });

  it('toggles [active] off the router modal slot when nested inside <uc-modal>', async () => {
    const ctxName = freshCtxName();
    // `closest('uc-modal')` selects the foreground (modal) slot; the tag need
    // not be an upgraded custom element for `closest` to match by name.
    const modal = document.createElement('uc-modal');
    const el = document.createElement('uc-test-modal-activity') as ModalActivityBlock & {
      updateComplete: Promise<unknown>;
    };
    el.setAttribute('ctx-name', ctxName);
    modal.append(el);
    document.body.append(modal);
    mounted.push(modal);
    await el.updateComplete;

    expect(el.hasAttribute('active')).toBe(false);

    // Foreground modal slot opens on this block's activity → [active] appears,
    // even though the background slot is untouched.
    router(ctxName).openModal(ACTIVITY_TYPES.CAMERA);
    await flush(el);
    expect(el.hasAttribute('active')).toBe(true);

    // Modal closes → [active] clears reactively.
    router(ctxName).closeModal();
    await flush(el);
    expect(el.hasAttribute('active')).toBe(false);
  });

  it('does not gain [active] from a background transition while nested in a modal', async () => {
    // A modal-slot block keys off `router.modal`, never the background slot: a
    // background `setActivity` to its own type must NOT activate it.
    const ctxName = freshCtxName();
    const modal = document.createElement('uc-modal');
    const el = document.createElement('uc-test-modal-activity') as ModalActivityBlock & {
      updateComplete: Promise<unknown>;
    };
    el.setAttribute('ctx-name', ctxName);
    modal.append(el);
    document.body.append(modal);
    mounted.push(modal);
    await el.updateComplete;

    router(ctxName).setActivity(ACTIVITY_TYPES.CAMERA);
    await flush(el);
    expect(el.hasAttribute('active')).toBe(false);
  });

  it('reports its activity as mounted with the router while connected', async () => {
    const ctxName = freshCtxName();
    const el = document.createElement('uc-test-bg-activity') as BgActivityBlock & { updateComplete: Promise<unknown> };
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    expect(router(ctxName).hasMountedActivity(ACTIVITY_TYPES.UPLOAD_LIST)).toBe(true);
  });

  it('keeps a pre-existing activity attribute instead of overwriting it', async () => {
    const ctxName = freshCtxName();
    const el = document.createElement('uc-test-bg-activity') as BgActivityBlock & { updateComplete: Promise<unknown> };
    el.setAttribute('ctx-name', ctxName);
    // Preset the attribute before adoption: the base must not clobber it.
    el.setAttribute('activity', 'preset-value');
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    expect(el.getAttribute('activity')).toBe('preset-value');
  });

  it('exposes the router params via activityParams', async () => {
    const ctxName = freshCtxName();
    const el = document.createElement('uc-test-bg-activity') as BgActivityBlock & { updateComplete: Promise<unknown> };
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    router(ctxName).setActivity(ACTIVITY_TYPES.UPLOAD_LIST, { some: 'value' });
    await flush(el);
    expect(el.activityParams).toEqual({ some: 'value' });
  });
});

describe('ActivityChildBlock with a null activityType', () => {
  it('wires the router subscription but reports nothing and never activates', async () => {
    const ctxName = freshCtxName();
    const el = document.createElement('uc-test-null-activity') as NullActivityBlock & {
      updateComplete: Promise<unknown>;
    };
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    // No activity id → nothing reported, host never reflects `activity`/`active`.
    expect(el.hasAttribute('activity')).toBe(false);
    expect(el.hasAttribute('active')).toBe(false);
    expect(el.isActive).toBe(false);
    expect(router(ctxName).hasMountedActivity(ACTIVITY_TYPES.UPLOAD_LIST)).toBe(false);

    // `reportActivityMounted()` is a no-op (after releasing any prior report)
    // while `activityType` is null.
    el.callReport();
    expect(el.params).toEqual({});

    // A router transition still re-renders it (subscription wired even for a
    // null activityType) without ever toggling `[active]`.
    router(ctxName).setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
    await flush(el);
    expect(el.hasAttribute('active')).toBe(false);
  });
});
