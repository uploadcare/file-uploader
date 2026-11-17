import { ReactiveElement } from 'lit';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** `checkVisibility()` where the browser has it (Safari from 17.4), else whether the element has a box at all. */
export const isVisible = (el: Element): boolean => el.checkVisibility?.() ?? el.getClientRects().length > 0;

/** The first control in `root` a user can reach: focusable, enabled and visible. */
export const firstFocusable = (root: ParentNode): HTMLElement | undefined =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (el) => !el.matches(':disabled') && !el.closest('[inert]') && isVisible(el),
  );

/**
 * Resolves once every block in `root` has rendered. Rendering can add blocks that render in turn: it waits until a
 * round adds none. `guard` binds each wait to the caller's lifetime (`whileAdopted`).
 */
export async function blocksRendered(root: ParentNode, guard: (work: Promise<unknown>) => Promise<unknown>) {
  let seen = -1;
  for (let round = 0; round < 5; round++) {
    const blocks = [...root.querySelectorAll('*')].filter((el) => el instanceof ReactiveElement);
    if (blocks.length === seen) break;
    seen = blocks.length;
    await guard(Promise.all(blocks.map((el) => el.updateComplete)));
  }
}
