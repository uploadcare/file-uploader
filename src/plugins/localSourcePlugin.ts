import { definePlugin } from '../abstract/plugin';

/**
 * Local file picker plugin. Registers a "From device" source that opens the
 * native file dialog via `api.openSystemDialog()`. Presets auto-install
 * this as a sensible default; bare `<uc-uploader>` consumers opt in
 * explicitly (or omit it for fully programmatic flows).
 */
export const localSourcePlugin = definePlugin({
  id: 'local',
  setup({ uploader, sources }) {
    sources.register({
      id: 'local',
      label: 'src-type-local',
      icon: 'local',
      onSelect: () => uploader.api.openSystemDialog({ source: 'local' }),
    });
  },
});
