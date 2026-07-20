import { ConfigController } from './controllers/ConfigController';
import { type ControllerContainer, containerOf } from './di/ControllerContainer';
import { type Logger, logger } from './logger';

/**
 * The middle layer between the config-agnostic {@link logger} and the per-ctx
 * {@link ConfigController}: builds a scoped logger whose ctx-name and verbose
 * gate resolve (lazily, at log time) from `getContainer()`. This is the ONLY
 * place that pairing lives, so per-ctx controllers don't each repeat it.
 *
 * `error`/`warn`/`warnOnce` always print (prefixed with the ctx-name when the
 * container resolves one); the verbose tier (`log`/`debug`) prints only when
 * that ctx's `debug` config is on.
 */
export const scopedLogger = (scope: string, getContainer: () => ControllerContainer | undefined): Logger =>
  logger.scope(scope, {
    ctxName: () => getContainer()?.ctxName,
    isVerbose: () => getContainer()?.get(ConfigController).get('debug') ?? false,
  });

/**
 * Per-ctx logger for a container-built controller instance — resolves its own
 * container via the `CONTAINER` tag. The common case: `this._log =
 * controllerLogger(this, 'my-scope')`.
 */
export const controllerLogger = (instance: object, scope: string): Logger =>
  scopedLogger(scope, () => containerOf(instance));
