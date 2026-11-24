import type { PluginRender } from '../abstract/managers/plugin';

/** An activity `render` that mounts one element. No dispose: the renderer empties the host on unmount. */
export const renderElement =
  (tagName: string): PluginRender =>
  (host) => {
    host.append(document.createElement(tagName));
    return undefined;
  };
