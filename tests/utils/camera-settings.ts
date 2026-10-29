import type { Locator } from 'vitest/browser';

/**
 * A section of the camera settings accordion, by its label: the row that opens it and the options it opens onto.
 * The options are found even while the section is closed, so their state can be checked without opening it.
 */
export const settingOf = (camera: Locator, name: string) => {
  const row = camera.getByText(name, { exact: true });
  const options = camera.getByRole('radiogroup', { name, exact: true, includeHidden: true });
  const radios = () => [...options.element().querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  const option = (text: string) => options.getByRole('radio', { name: text, exact: true, includeHidden: true });

  return {
    row,
    options,
    option,
    radios,
    texts: () => radios().map((radio) => radio.labels?.[0]?.textContent?.trim()),
    isOpen: () => options.element().closest('details')?.open ?? false,
    /** Opens the section unless it is open already, then picks the option. */
    pick: async (text: string) => {
      if (!options.element().closest('details')?.open) await row.click();
      await option(text).click();
    },
  };
};
