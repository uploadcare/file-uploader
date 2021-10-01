import { DEPLOY_ENV, VERSION } from './env.js';

const ASSETS_CDN_HOST = 'ucarecdn.com';
const ASSETS_PROD_URL = `https://${ASSETS_CDN_HOST}/libs/editor/${VERSION}`;
const ASSETS_STAGING_ROOT_URL = 'src';
const ASSETS_STYLES_PATH = 'css';
const ASSETS_LOCALES_PATH = 'l10n/locales';

export const ASSETS_ROOT_URL = DEPLOY_ENV === 'production' ? ASSETS_PROD_URL : ASSETS_STAGING_ROOT_URL;
export const ASSETS_STYLES_URL = `${ASSETS_ROOT_URL}/${ASSETS_STYLES_PATH}`;
export const ASSETS_LOCALES_URL = `${ASSETS_ROOT_URL}/${ASSETS_LOCALES_PATH}`;
