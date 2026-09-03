import { describe, expect, it } from 'vitest';
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import { ValidationController } from '../abstract/controllers/ValidationController';
import { buildUploaderScopeDeps } from './buildUploaderScopeDeps';

describe('buildUploaderScopeDeps', () => {
  // The builder is now purely the value-import boundary for the four
  // upload-stack constructors `registerUploadStack` binds — there is no host
  // bridge (each controller `@inject`s its real collaborators). The telemetry
  // never-throw guarantee that used to live in the removed sinks now lives on
  // `TelemetryManager.sendEventError` (covered in its own spec).
  it('returns exactly the four upload-stack constructors', () => {
    expect(buildUploaderScopeDeps()).toEqual({
      SecureUploadsController,
      UploadController,
      ValidationController,
      UploadEventsController,
    });
  });
});
