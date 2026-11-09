export type { ActivityType, CustomActivities } from '../abstract/activity-constants';
export type { CustomConfig, CustomConfigDefinition } from '../abstract/customConfigOptions';
export type { CustomLocaleDefinition } from '../abstract/localeRegistry';
export type * from '../abstract/managers/plugin/PluginTypes';
export type * from './events';
export type * from './exported';
// `export type *` above strips values, and the docs import `EventType` as one for `api.on`.
// Values too, so an upload's `error` can be checked with `instanceof`.
export {
  AuthTokenResolverError,
  EventType,
  NetworkError,
  UploadcareError,
  UploadcareFile,
  UploadcareGroup,
  UploadError,
} from './exported';
