// @ts-check

/**
 * @template {keyof import('../types').ConfigType} T
 * @param {T} key
 * @returns {`*cfg/${T}`}
 */
export const sharedConfigKey = (key) => `*cfg/${key}`;
