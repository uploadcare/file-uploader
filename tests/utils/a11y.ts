import axe, { type ElementContext, type Result } from 'axe-core';

export type A11yScanOptions = {
  /** Run only these rule ids. */
  only?: string[];
  /** Skip these rule ids. Name each one and why at the call site. */
  disable?: string[];
};

const describeViolation = ({ id, impact, help, nodes }: Result): string =>
  [
    `${id} (${impact ?? 'no impact'}): ${help}`,
    ...nodes.map((node) => {
      const why = [...node.any, ...node.all, ...node.none].map((check) => check.message).join('; ');
      return `    ${node.target.join(' ')}${why ? ` — ${why}` : ''}`;
    }),
  ].join('\n');

/** The elements `context` names directly: an element, or the elements among its `include`. */
const scannedElements = (context: ElementContext): Element[] => {
  if (context instanceof Element) return [context];
  const include = typeof context === 'object' && context !== null && 'include' in context ? context.include : [];
  return [include].flat(Infinity).filter((node): node is Element => node instanceof Element);
};

/**
 * Colour contrast read mid-transition (a modal fading in) blends the colours and reports what nobody sees, so wait for
 * the animations that paint the scanned elements: their own and their descendants', and their ancestors' (the modal's
 * fade). An infinite one (a spinner) never finishes and changes no colour for good, and a cancelled one has stopped.
 */
async function animationsSettled(context: ElementContext): Promise<void> {
  const animations = scannedElements(context).flatMap((element) => {
    const ancestors: Element[] = [];
    for (let el = element.parentElement; el; el = el.parentElement) ancestors.push(el);
    return [...element.getAnimations({ subtree: true }), ...ancestors.flatMap((el) => el.getAnimations())];
  });
  const finite = animations.filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
  await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
}

/**
 * Runs axe-core in the page against `context` (the real DOM of the browser project) and throws with every violation:
 * rule id, impact, help text and the selectors of the offending nodes.
 */
export async function expectNoA11yViolations(context: ElementContext, { only, disable = [] }: A11yScanOptions = {}) {
  await animationsSettled(context);
  const { violations } = await axe.run(context, {
    ...(only ? { runOnly: { type: 'rule', values: only } } : {}),
    rules: Object.fromEntries(disable.map((id) => [id, { enabled: false }])),
  });
  if (violations.length) {
    throw new Error(`axe found ${violations.length} violation(s):\n${violations.map(describeViolation).join('\n')}`);
  }
}
