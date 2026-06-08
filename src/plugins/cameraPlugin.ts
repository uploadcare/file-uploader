import { browserFeatures } from '../utils/browser-info';
import { deserializeCsv } from '../utils/comma-separated';
import '../blocks/CameraSource/CameraSource';
import { definePlugin } from '../abstract/plugin';

const PHOTO = 'photo' as const;
const VIDEO = 'video' as const;

/**
 * Camera plugin for v2. Three sources:
 *
 *  - `camera`: desktop. Opens an in-page MediaStream-based capture activity.
 *    On mobile (when `htmlMediaCapture` is supported), `expand()` replaces
 *    this with mobile photo/video sources that pop the system camera.
 *  - `mobile-photo-camera`: mobile-only. Calls `openSystemDialog` with
 *    `captureCamera: true, modeCamera: 'photo'`. Hidden from the regular
 *    source list (rendered only via `expand()`).
 *  - `mobile-video-camera`: same, but video.
 *
 * Spike scope: photo capture only on desktop. Real-time video recording with
 * MediaRecorder is straightforward to add in a follow-up; this commit
 * focuses on proving the plugin shape covers the full v1 camera surface.
 */
export const cameraPlugin = definePlugin({
  id: 'camera',
  setup({ uploader, sources, activities }) {
    sources.register({
      id: 'camera',
      label: 'src-type-camera',
      onSelect: () => uploader.router.navigate('camera'),
      expand: () => {
        if (!browserFeatures.htmlMediaCapture) return ['camera'];
        const modes = deserializeCsv(
          (uploader.config.values as { cameraModes?: string }).cameraModes ?? 'photo, video',
        );
        return modes.length ? modes.map((m) => `mobile-${m}-camera`) : ['mobile-photo-camera'];
      },
    });

    sources.register({
      id: 'mobile-photo-camera',
      label: 'src-type-mobile-photo-camera',
      hiddenFromList: true,
      onSelect: () => {
        // `openSystemDialog` itself fires `router.afterFileAdd()` when
        // the user picks — no need to navigate here pre-pick.
        uploader.api.openSystemDialog({
          captureCamera: true,
          modeCamera: PHOTO,
          source: 'camera',
        });
      },
    });

    sources.register({
      id: 'mobile-video-camera',
      label: 'src-type-mobile-video-camera',
      hiddenFromList: true,
      onSelect: () => {
        uploader.api.openSystemDialog({
          captureCamera: true,
          modeCamera: VIDEO,
          source: 'camera',
        });
      },
    });

    activities.register({
      id: 'camera',
      routes: { onFileAdd: 'upload-list', onCancel: 'start-from' },
      render(host) {
        const el = document.createElement('uc-camera-source');
        host.append(el);
        return () => host.replaceChildren();
      },
    });
  },
});
