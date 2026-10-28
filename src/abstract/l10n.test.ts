import { describe, expect, it } from 'vitest';
import { LocaleController } from './controllers/LocaleController';
import { type CheckedL10nFunction, createL10n, type PlainText } from './l10n';

// M-god step 7: `createL10n` reads the resolved dictionary directly from a
// `LocaleController` (was the `*l10n/*` PubSub facade). These specs pin the
// key-fallback, empty-string, template-variable, and live-read contracts.
describe('createL10n (direct LocaleController)', () => {
  const setup = () => {
    const locale = new LocaleController();
    const l10n = createL10n(() => locale);
    return { locale, l10n };
  };

  it('returns the dictionary value for a known key', () => {
    const { locale, l10n } = setup();
    locale.set('upload-file', 'Upload file');
    expect(l10n('upload-file')).toBe('Upload file');
  });

  it('falls back to the key itself when the dictionary has no entry', () => {
    const { l10n } = setup();
    expect(l10n('no-such-key')).toBe('no-such-key');
  });

  it('returns an empty string for an empty key (no dictionary touch)', () => {
    const { l10n } = setup();
    expect(l10n('')).toBe('');
  });

  it('interpolates template variables', () => {
    const { locale, l10n } = setup();
    locale.set('greet', 'Hello {{name}}!');
    expect(l10n('greet', { name: 'Ada' })).toBe('Hello Ada!');
  });

  it('reads the LocaleController live — later writes are reflected', () => {
    const { locale, l10n } = setup();
    locale.set('upload-file', 'Upload file');
    expect(l10n('upload-file')).toBe('Upload file');
    locale.set('upload-file', 'Subir archivo');
    expect(l10n('upload-file')).toBe('Subir archivo');
  });

  it('resolves ICU-style plurals against the dictionary (via the pluralizer)', () => {
    const { locale, l10n } = setup();
    locale.set('locale-id', 'en');
    locale.set('file__one', 'file');
    locale.set('file__other', 'files');
    locale.set('header-uploading', 'Uploading {{count}} {{plural:file(count)}}');
    expect(l10n('header-uploading', { count: 1 })).toBe('Uploading 1 file');
    expect(l10n('header-uploading', { count: 3 })).toBe('Uploading 3 files');
  });
});

describe('CheckedL10nFunction', () => {
  it('rejects a misspelt key and a bare string at compile time, and takes text asserted as PlainText', () => {
    const l10n: CheckedL10nFunction = (key: string, _variables?: Record<string, string | number>) => key;
    const fromConfig: string = 'whatever';

    // @ts-expect-error 'uplaod' is not a dictionary key
    l10n('uplaod');
    expect(l10n('upload')).toBe('upload');
    // @ts-expect-error a string from elsewhere is not a key until marked
    l10n(fromConfig);
    expect(l10n(fromConfig as PlainText)).toBe('whatever');
  });

  it("checks a key's variables against its English template", () => {
    const l10n: CheckedL10nFunction = (key: string, _variables?: Record<string, string | number>) => key;

    l10n('waiting-for', { source: 'Dropbox' });
    // `{{plural:file(count)}}` needs `count` too.
    l10n('header-uploading', { count: 2 });
    l10n('upload-file');
    // Text asserted as PlainText has no known template, so it takes any variables.
    l10n('Hi {{name}}' as PlainText, { name: 'Ada' });

    // @ts-expect-error the template interpolates `source`
    l10n('waiting-for');
    // @ts-expect-error the template's variable is `count`
    l10n('header-uploading', { cnt: 2 });
    // @ts-expect-error the template interpolates nothing
    l10n('upload-file', { count: 1 });
    // @ts-expect-error `extra` is not in the template
    l10n('waiting-for', { source: 'Dropbox', extra: 1 });
    expect(l10n('upload-file')).toBe('upload-file');
  });
});
