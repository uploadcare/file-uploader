import { EventBus } from '../EventBus';
import { buildOutputCollectionState } from '../output-collection-state';
import { buildLegacyPluginCtx } from '../plugin-api-bridge';
import { UploaderApi } from '../UploaderApi';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
import { type PluginDefinition, PluginRegistryController, type PluginSetupContext } from './PluginRegistryController';
import { RouterController } from './RouterController';
import { SecureUploadsController } from './SecureUploadsController';
import { SourcesController } from './SourcesController';
import { Telemetry } from './Telemetry';
import { UploadCollectionController } from './UploadCollectionController';
import { UploadController } from './UploadController';
import { ValidationController } from './ValidationController';

/**
 * Root controller. One instance per `<uc-uploader>` element. Holds
 * sub-controllers, the public api facade, and the EventBus. Pure logic —
 * does not import from `lit` or touch the DOM.
 */
export class UploaderController {
  public readonly events = new EventBus();
  public readonly config = new ConfigController();
  public readonly router = new RouterController(this.events);
  public readonly locale = new LocaleController(this.config);
  public readonly validation = new ValidationController(this.config, this.locale);
  public readonly collection = new UploadCollectionController(this.events, this.config, this.validation);
  public readonly secureUploads = new SecureUploadsController(this.config);
  public readonly upload = new UploadController(this.events, this.config, this.validation, this.secureUploads);
  public readonly plugins = new PluginRegistryController();
  public readonly sources = new SourcesController(this, this.config, this.plugins);
  public readonly telemetry = new Telemetry(this.config, this.events);
  public readonly api = new UploaderApi(this, this.config, this.router, this.collection, this.events, this.upload);

  public constructor() {
    this.validation.start(this.collection.collection);
    this.upload.start(this.collection.collection, this.collection, this);
    // User collection validators receive the v1-shape `OutputCollectionState`
    // — built-ins keep the cheaper `ValidationItem[]` signature. User file
    // validators receive the `UploaderApi` as their `api` argument (v1
    // parity).
    this.validation.setUserCollectionStateFactory(() => buildOutputCollectionState(this));
    this.validation.setUserApiFactory(() => this.api);
  }

  public install(plugin: PluginDefinition): void {
    const legacy = buildLegacyPluginCtx(this, plugin.id);
    const ctx = {
      // v2-native ctx — used by `src/v2/plugins/*`.
      uploader: this,
      sources: { register: (s) => this.plugins.registerSource(s) },
      activities: {
        register: (a) => {
          const unsub = this.plugins.registerActivity(a);
          if (a.routes) this.router.addPluginRoutes(a.id, a.routes);
          return unsub;
        },
      },
      actions: { register: (a) => this.plugins.registerAction(a) },
      hooks: {
        beforeUpload: (h) => this.collection.registerBeforeUpload(h),
      },
      config: {
        register: (name, defaultValue) => this.config.register(name, defaultValue),
        get: (name) => this.config.getCustom(name),
        set: (name, value) => this.config.setCustom(name, value),
      },
      locale: { merge: (entries) => this.locale.merge(entries) },
      icons: { register: (name, svg) => this.plugins.registerIcon(name, svg) },
      // v1-shape ctx — used by `src/plugins/*` and test-authored plugins.
      // Both shapes live in the same object; destructuring at setup() picks
      // whichever the plugin actually needs.
      pluginApi: legacy.pluginApi,
      uploaderApi: legacy.uploaderApi,
    } as PluginSetupContext;
    this.plugins.install(plugin, ctx, legacy.teardown);
  }

  public destroy(): void {
    this.events.destroy();
    this.config.destroy();
    this.router.destroy();
    this.collection.destroy();
    this.upload.destroy();
    this.plugins.destroy();
    this.sources.destroy();
    this.validation.destroy();
    this.locale.destroy();
    this.telemetry.destroy();
    this.secureUploads.destroy();
  }
}
