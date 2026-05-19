import type { ConfigType } from '../../types/index';
import { debounce } from '../../utils/debounce';
import { warnOnce } from '../../utils/warnOnce';

type Assertion = {
  test: (cfg: ConfigType) => boolean;
  message: string;
};

const ASSERTIONS: Assertion[] = [
  {
    test: (cfg) => !!cfg.accept && !!cfg.imgOnly,
    message:
      'There could be a mistake.\n' +
      'Both `accept` and `imgOnly` parameters are set.\n' +
      'The value of `accept` will be concatenated with the internal image mime types list.',
  },
  {
    test: (cfg) => cfg.enableVideoRecording !== null,
    message:
      'The `enableVideoRecording` parameter is deprecated and will be removed in the next major release.\n' +
      'Please use the `cameraModes` parameter instead.',
  },
  {
    test: (cfg) => cfg.defaultCameraMode !== null,
    message:
      'The `defaultCameraMode` parameter is deprecated and will be removed in the next major release.\n' +
      'Please use the `cameraModes` parameter instead.',
  },
];

/** Runs on every config change and warns about potential issues. */
export const runAssertions = debounce((cfg: ConfigType) => {
  for (const { test, message } of ASSERTIONS) {
    if (test(cfg)) {
      warnOnce(message);
    }
  }
}, 0);
