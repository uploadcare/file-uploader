import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { CONFIG_VALUES, TEST_LOCALE } from '@/blocks/Config/__tests__/configValues';
import { configAttributeBehavior } from '@/blocks/Config/Config';
import { initialConfig } from '@/blocks/Config/initialConfig';
import { type Config, defineLocale } from '@/index';
import en from '@/locales/file-uploader/en';
import type { ConfigType } from '@/types/exported';
import { delay } from '@/utils/delay';
import { toKebabCase } from '@/utils/toKebabCase';
import { createInCtx, inCtx } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * Every value each option's type permits, set on a real `<uc-config>` and read
 * back.
 *
 * The unit tests under `src/blocks/Config` cover the validators directly; this
 * covers the element, which is the only surface an integrator touches. The two
 * are not interchangeable: `authToken` had a passing unit test for the
 * provider shape while the element dropped it, because that test stubbed the
 * context and so never reached the validator at all.
 *
 * The values come from `CONFIG_VALUES`, shared with the validator-level sweep
 * so the two layers are held to one table rather than two that drift.
 */

// Only `en` ships registered; every other locale is the integrator's to add.
// `localeName` is typed `string`, but its real domain is "a locale someone
// registered", so the sweep registers one rather than naming a locale that
// only exists as a file on disk.
defineLocale(TEST_LOCALE, en);

const keys = Object.keys(CONFIG_VALUES) as (keyof ConfigType)[];

const isPropertyOnly = (key: keyof ConfigType): boolean =>
  (configAttributeBehavior as Record<string, { attribute?: boolean } | undefined>)[key]?.attribute === false;

/** `<uc-config>` on its own: no uploader, so nothing reacts to a value and each option is read back in isolation. */
const mountConfig = async (attrs: Record<string, string> = {}): Promise<Config> => {
  const ctxName = getCtxName();
  const config = createInCtx<Config>('uc-config', ctxName, {
    pubkey: 'demopublickey',
    'test-mode': 'true',
    'quality-insights': 'false',
    ...attrs,
  });

  page.render(<div ctx-name={ctxName}></div>);
  inCtx('div', ctxName).append(config);
  await delay(0);

  return config;
};

describe('the table matches ConfigType', () => {
  it('lists every option', () => {
    // Both sides are compiler-guaranteed today: `CONFIG_VALUES` is a required
    // mapped type and `initialConfig` is declared `satisfies ConfigType`. This
    // stands guard over that, since loosening the table to a partial is the
    // obvious shortcut when adding an option, and the sweeps would then skip
    // it in silence — which is how `authToken` went unnoticed.
    expect(keys.sort()).toEqual(Object.keys(initialConfig).sort());
  });

  it('gives every option at least one value', () => {
    expect(keys.filter((key) => CONFIG_VALUES[key].length === 0)).toEqual([]);
  });
});

/** The one cast the sweeps need: the value is `unknown`, the property is not. */
const write = (config: Config, key: keyof ConfigType, value: unknown): void => {
  (config as unknown as Record<string, unknown>)[key] = value;
};

/**
 * `normalizeConfigValue` reports a rejected value to `console.error` and falls
 * back to the default rather than throwing. Reading the value back therefore
 * proves nothing on its own: an option set to its own default reads back
 * correctly whether it was accepted or thrown out. Every case below pairs the
 * readback with this.
 */
const captureErrors = async (run: () => Promise<void>): Promise<unknown[][]> => {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    await run();
  } finally {
    console.error = original;
  }
  return errors;
};

describe('accepts every value its type describes, as a property', () => {
  for (const key of keys) {
    // Wrapped in a tuple: `it.each` spreads a top-level array into arguments,
    // which would unwrap the array-valued options into nothing.
    it.each((CONFIG_VALUES[key] as unknown[]).map((value) => [value]))(`${key} = %o`, async (value) => {
      const config = await mountConfig();

      const errors = await captureErrors(async () => {
        write(config, key, value);

        if (value === null) {
          expect(config[key] ?? null).toBeNull();
        } else {
          expect(config[key]).toEqual(value);
        }
      });

      expect(errors).toEqual([]);
    });
  }
});

describe('accepts the attribute form of every option that has one', () => {
  const attributeCases = keys
    .filter((key) => !isPropertyOnly(key))
    .flatMap((key) =>
      (CONFIG_VALUES[key] as unknown[])
        // Only primitives survive the trip through an attribute; the rest are
        // property-only by nature and are covered above.
        .filter((value) => ['string', 'number', 'boolean'].includes(typeof value))
        .map((value) => [key, String(value), value] as const),
    );

  it.each(attributeCases)('%s="%s"', async (key, attribute, expected) => {
    // The capture spans the mount, not just a later assignment: an attribute
    // is read while the element connects, which is where it would be
    // rejected. Without this, an attribute carrying its option's own default
    // — `multiple="true"`, `test-mode="false"` — reads back correctly even
    // when the validator threw it out.
    const errors = await captureErrors(async () => {
      // Set before connection, which is how a page writes them and the only
      // route that exercises the string coercion React and Vue produce.
      const config = await mountConfig({ [toKebabCase(key)]: attribute });

      expect(config[key]).toEqual(expected);
    });

    expect(errors).toEqual([]);
  });
});
