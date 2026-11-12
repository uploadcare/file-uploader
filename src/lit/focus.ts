import { ReactiveElement } from 'lit';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The first control in `root` a user can reach: focusable, enabled and visible. */
export const firstFocusable = (root: ParentNode, skip?: (el: HTMLElement) => boolean): HTMLElement | undefined =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (el) => !el.matches(':disabled') && !el.closest('[inert]') && !skip?.(el) && el.checkVisibility(),
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
