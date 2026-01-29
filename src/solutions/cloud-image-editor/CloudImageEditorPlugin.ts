import { html, type TemplateResult } from 'lit';
import type { Plugin } from '../../abstract/Plugin';
import type { LitSolutionBlock } from '../../lit/LitSolutionBlock';
import { LitActivityBlock } from '../../lit/LitActivityBlock';

// Import the CloudImageEditorActivity block
import '../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';

/**
 * Plugin ID for the cloud image editor
 */
export const CLOUD_IMAGE_EDITOR_PLUGIN_ID = 'cloud-image-editor';

/**
 * Cloud Image Editor Plugin
 * Adds image editing capabilities to the file uploader
 */
export class CloudImageEditorPlugin implements Plugin {
  public readonly pluginId = CLOUD_IMAGE_EDITOR_PLUGIN_ID;
  private _solution: LitSolutionBlock | null = null;
  private _originalRender: (() => TemplateResult) | null = null;

  /**
   * Initialize the plugin
   */
  public init(solution: LitSolutionBlock): void {
    this._solution = solution;

    // Store the original render method
    this._originalRender = solution.render.bind(solution);

    // Override the render method to include cloud image editor modal
    solution.render = this._createEnhancedRender(solution);
  }

  /**
   * Cleanup the plugin
   */
  public destroy(): void {
    // Restore original render if available
    if (this._solution && this._originalRender) {
      this._solution.render = this._originalRender;
    }
    this._solution = null;
    this._originalRender = null;
  }

  /**
   * Create an enhanced render function that includes the cloud image editor modal
   */
  private _createEnhancedRender(solution: LitSolutionBlock): () => TemplateResult {
    const originalRender = this._originalRender!;

    return function (this: LitSolutionBlock) {
      const baseTemplate = originalRender.call(this);

      // Add the cloud image editor modal to the template
      const editorModal = html`
        <uc-modal id="${LitActivityBlock.activities.CLOUD_IMG_EDIT}" strokes block-body-scrolling>
          <uc-cloud-image-editor-activity></uc-cloud-image-editor-activity>
        </uc-modal>
      `;

      return html`${baseTemplate}${editorModal}`;
    };
  }
}

/**
 * Factory function to create a cloud image editor plugin instance
 */
export function createCloudImageEditorPlugin(): CloudImageEditorPlugin {
  return new CloudImageEditorPlugin();
}
