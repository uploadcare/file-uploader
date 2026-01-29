/**
 * Abstract Custom Activity Renderer
 * 
 * This interface defines an abstract API for rendering custom activity content.
 * Plugins can implement custom activities using any rendering approach (Lit, React, Vue, vanilla JS, etc.)
 * 
 * The file uploader solutions will call these lifecycle methods at appropriate times.
 */

/**
 * Custom activity renderer interface
 * Plugins implement this to provide custom activity rendering
 */
export interface CustomActivityRenderer {
  /**
   * Unique identifier for this activity
   */
  activityType: string;

  /**
   * Render the activity content into a container element
   * @param container - DOM element to render into
   * @param context - Context object with access to uploader APIs
   */
  render(container: HTMLElement, context: CustomActivityContext): void;

  /**
   * Called when the activity is activated/shown
   */
  onActivate?(): void;

  /**
   * Called when the activity is deactivated/hidden
   */
  onDeactivate?(): void;

  /**
   * Cleanup method called when activity is destroyed
   */
  destroy?(): void;
}

/**
 * Context provided to custom activity renderers
 * Provides access to uploader functionality without coupling to implementation
 */
export interface CustomActivityContext {
  /**
   * Add a file from URL to the upload list
   */
  addFileFromUrl(url: string, options?: { fileName?: string; source?: string }): Promise<void>;

  /**
   * Navigate back in activity history
   */
  historyBack(): void;

  /**
   * Navigate to another activity
   */
  setActivity(activityType: string, params?: Record<string, unknown>): void;

  /**
   * Get localized string
   */
  l10n(key: string): string;

  /**
   * Get configuration value
   */
  getConfig<T = unknown>(key: string): T;

  /**
   * Subscribe to state changes
   */
  subscribe<T = unknown>(key: string, callback: (value: T) => void): () => void;
}

/**
 * Example: Vanilla JS renderer
 * 
 * class VanillaUnsplashRenderer implements CustomActivityRenderer {
 *   activityType = 'unsplash';
 * 
 *   render(container: HTMLElement, context: CustomActivityContext) {
 *     container.innerHTML = `
 *       <div class="unsplash-activity">
 *         <h2>Unsplash Photos</h2>
 *         <div id="image-grid"></div>
 *       </div>
 *     `;
 *     
 *     const grid = container.querySelector('#image-grid');
 *     // Fetch and render images...
 *     // Add click handlers that call context.addFileFromUrl()
 *   }
 * 
 *   destroy() {
 *     // Cleanup event listeners, etc.
 *   }
 * }
 */

/**
 * Example: React renderer
 * 
 * class ReactUnsplashRenderer implements CustomActivityRenderer {
 *   activityType = 'unsplash';
 *   private root: ReactDOM.Root | null = null;
 * 
 *   render(container: HTMLElement, context: CustomActivityContext) {
 *     import('react-dom/client').then(({ createRoot }) => {
 *       this.root = createRoot(container);
 *       this.root.render(<UnsplashActivity context={context} />);
 *     });
 *   }
 * 
 *   destroy() {
 *     this.root?.unmount();
 *   }
 * }
 */

/**
 * Helper to register a custom activity renderer with a plugin
 */
export interface CustomActivityConfig {
  /**
   * The renderer implementation
   */
  renderer: CustomActivityRenderer;

  /**
   * Icon for the source button (optional)
   */
  icon?: string;

  /**
   * Localization key for button text (optional)
   */
  textKey?: string;
}
