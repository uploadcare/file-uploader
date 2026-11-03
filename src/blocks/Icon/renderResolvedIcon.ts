import { html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { PluginIconRegistration } from '../../abstract/managers/plugin/PluginTypes';
import type { IconHrefResolver } from '../../types/exported';
import { renderIconSvg } from './renderIconSvg';

/**
 * The uploader's icon lookup, shared by `uc-icon` and the editor icons inside the uploader so they cannot drift: a
 * plugin-registered icon first, then `iconHrefResolver`, then the built-in sprite.
 */
export function renderResolvedIcon(
  name: string,
  pluginIcons: readonly PluginIconRegistration[] | undefined,
  iconHrefResolver: IconHrefResolver | null | undefined,
): TemplateResult {
  const pluginIcon = pluginIcons?.find((icon) => icon.name === name);
  if (pluginIcon) {
    return html`${unsafeSVG(pluginIcon.svg)}`;
  }
  return renderIconSvg(iconHrefResolver?.(name) ?? `#uc-icon-${name}`);
}
