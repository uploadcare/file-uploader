import { calculateMaxCenteredCropFrame } from '../../blocks/CloudImageEditor/src/crop-utils';
import { parseCropPreset } from '../../blocks/CloudImageEditor/src/lib/parseCropPreset';
import { createCdnUrl, createCdnUrlModifiers } from '../../utils/cdn-utils';
import { ACTIVITY_TYPES } from '../activity-constants';
import type { LitUploaderBlock } from '../LitUploaderBlock';

type CloudImageEditorHost = LitUploaderBlock;

export class CloudImageEditorController {
  private readonly host: CloudImageEditorHost;

  public constructor(host: CloudImageEditorHost) {
    this.host = host;
  }

  private canUseCloudImageEditor(): boolean {
    return (
      this.host.uploadCollection.size === 1 &&
      this.host.cfg.useCloudImageEditor &&
      this.host.hasBlockInCtx((block) => block.activityType === ACTIVITY_TYPES.CLOUD_IMG_EDIT)
    );
  }

  private openEditor(entryUid: string): void {
    this.host.sharedCtx.pub('*currentActivityParams', { internalId: entryUid });
    this.host.sharedCtx.pub('*currentActivity', ACTIVITY_TYPES.CLOUD_IMG_EDIT);
    this.host.modalManager?.open(ACTIVITY_TYPES.CLOUD_IMG_EDIT);
  }

  public openCloudImageEditor(): void {
    const [entryId] = this.host.uploadCollection.findItems(
      (entry) => !!entry.getValue('fileInfo') && entry.getValue('isImage'),
    );
    const entry = entryId ? this.host.uploadCollection.read(entryId) : undefined;

    if (entry && this.canUseCloudImageEditor()) {
      this.openEditor(entry.uid);
    }
  }

  public setInitialCrop(): void {
    const cropPreset = parseCropPreset(this.host.cfg.cropPreset);
    if (!cropPreset) return;

    const [aspectRatioPreset] = cropPreset;
    const expectedAspectRatio =
      typeof aspectRatioPreset?.width === 'number' &&
      typeof aspectRatioPreset?.height === 'number' &&
      aspectRatioPreset.width > 0 &&
      aspectRatioPreset.height > 0
        ? aspectRatioPreset.width / aspectRatioPreset.height
        : 1;

    const entries = this.host.uploadCollection
      .findItems(
        (entry) =>
          !!entry.getValue('fileInfo') &&
          entry.getValue('isImage') &&
          !entry.getValue('cdnUrlModifiers')?.includes('/crop/'),
      )
      .map((id) => this.host.uploadCollection.read(id))
      .filter(Boolean);

    for (const entry of entries) {
      const fileInfo = entry.getValue('fileInfo');
      const imageInfo = fileInfo?.imageInfo;
      if (!imageInfo) {
        console.warn('Failed to get image info for entry', entry.uid);
        continue;
      }

      const crop = calculateMaxCenteredCropFrame(imageInfo.width, imageInfo.height, expectedAspectRatio);
      const cdnUrlModifiers = createCdnUrlModifiers(`crop/${crop.width}x${crop.height}/${crop.x},${crop.y}`, 'preview');
      const cdnUrl = entry.getValue('cdnUrl');
      if (!cdnUrl) {
        console.warn('Failed to get cdnUrl for entry', entry.uid);
        continue;
      }

      entry.setMultipleValues({
        cdnUrlModifiers,
        cdnUrl: createCdnUrl(cdnUrl, cdnUrlModifiers),
      });

      if (this.canUseCloudImageEditor()) {
        this.openEditor(entry.uid);
      }
    }
  }
}
