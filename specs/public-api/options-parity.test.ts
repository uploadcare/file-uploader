import { describe, expect, it } from 'vitest';
import { initialConfig } from '@/blocks/Config/initialConfig';
import { toKebabCase } from '@/utils/toKebabCase';
import surface from './public-surface.json' with { type: 'json' };

/**
 * The documented `<uc-config>` contract lives in another repo (`fern-docs`), so it is transcribed into
 * `public-surface.json` and asserted here. A failure means either the code broke a documented promise, or the docs
 * moved and the fixture was not refreshed.
 *
 * Where the two already disagree, the fixture's `knownMismatch` block records the actual value and why. The test then
 * pins reality, so the drift stays visible in one place instead of being silently absent.
 */

type OptionName = keyof typeof initialConfig;

/** Shape of one entry in `public-surface.json`; `value` is absent when the docs give no parsable literal. */
type DocumentedOption = {
  attribute: string | null;
  /** `null` where the docs give no `Type:` line for the option. */
  type: string | null;
  documented: string | null;
  value?: unknown;
};

const options: [string, DocumentedOption][] = Object.entries(surface.options);
const names = options.map(([name]) => name);
const mismatches = surface.knownMismatch as Record<string, { actual: unknown } | undefined>;

const expectedDefault = (name: string, documented: unknown) =>
  name in mismatches ? mismatches[name]?.actual : documented;

describe('documented config options', () => {
  it('covers every option the docs list', () => {
    expect(names).toHaveLength(64);
  });

  it.each(names)('%s exists on the default config', (name) => {
    expect(initialConfig).toHaveProperty(name);
  });

  // Options documented with `Attribute: -` are settable as a JS property only.
  it.each(options.filter(([, o]) => o.attribute !== null))('%s uses its documented attribute name', (name, o) => {
    expect(o.attribute).toBe(toKebabCase(name));
  });

  it.each(options.filter(([, o]) => 'value' in o))('%s has the documented default', (name, o) => {
    expect(initialConfig[name as OptionName]).toBe(expectedDefault(name, o.value));
  });

  // QUIRK(config): four documented defaults do not match the shipped ones — `multipleMax` (docs `0`, code
  // Number.MAX_SAFE_INTEGER), `retryThrottledRequestMaxTimes` (docs `10`, code `3`), `enableVideoRecording`
  // (docs `true`, code `null`) and `cdnCname` (docs give the resolved CNAME, code the pre-resolution literal — the
  // only one of the four that is not a defect). See `knownMismatch` in public-surface.json for each. Pinned as
  // current behaviour, not endorsed: fixing them means changing either the docs or a shipped default.
  it('has no undeclared default mismatches', () => {
    const drifted = options
      .filter(([name, o]) => 'value' in o && initialConfig[name as OptionName] !== o.value)
      .map(([name]) => name);
    expect(drifted.sort()).toEqual(Object.keys(mismatches).sort());
  });

  it('reports options that exist in code but are not documented', () => {
    // Undocumented internals may change freely (AGENTS.md, "Do not break"), so this is an inventory rather than a
    // constraint — it fails only when the list moves, keeping the contract/internals split deliberate.
    const undocumented = Object.keys(initialConfig).filter((name) => !names.includes(name));
    expect(undocumented.sort()).toEqual([
      'cdnCnamePrefixed',
      'externalSourcesEmbedCss',
      'mediaRecorderOptions',
      'modalBackdropStrokes',
      'modalScrollLock',
      'plugins',
      'sourceListWrap',
      'testMode',
      'useLocalImageEditor',
      'userAgentIntegration',
    ]);
  });
});
