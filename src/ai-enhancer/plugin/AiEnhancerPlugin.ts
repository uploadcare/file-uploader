import type { UploaderPlugin } from '../../abstract/managers/plugin';
import { enLocale } from '../locales/en';
import type { ApplyDetail, UcAiEditor } from '../UcAiEditor';
import { ICON_EDIT_AI, ICON_GENERATE } from '../ui/icons';

import '../UcAiEditor';

const PLUGIN_ID = 'ai-enhancer';
const SOURCE_ID = 'ai-generate';
const FILE_ACTION_ID = 'ai-edit';
const ACTIVITY_ID = 'ai-editor' as const;

export type AiEditorActivityParams = {
  mode?: 'generate' | 'edit';
  src?: string;
  internalId?: string;
};

declare module '../../lit/LitActivityBlock' {
  interface CustomActivities {
    'ai-editor': { params: AiEditorActivityParams };
  }
}

async function urlToFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

export const AiEnhancerPlugin: UploaderPlugin = {
  id: PLUGIN_ID,
  setup: ({ pluginApi, uploaderApi }) => {
    const { registry } = pluginApi;

    registry.registerIcon({ name: 'ai-generate', svg: ICON_GENERATE });
    registry.registerIcon({ name: 'ai-edit', svg: ICON_EDIT_AI });

    registry.registerL10n({ en: enLocale });

    registry.registerSource({
      id: SOURCE_ID,
      label: 'ai-enhancer-source-label',
      icon: 'ai-generate',
      onSelect: () => {
        uploaderApi.setCurrentActivity?.(ACTIVITY_ID, { mode: 'generate' });
        uploaderApi.setModalState?.(true);
      },
    });

    registry.registerFileAction({
      id: FILE_ACTION_ID,
      icon: 'ai-edit',
      label: 'ai-enhancer-file-action-label',
      shouldRender: (fileEntry) => Boolean(fileEntry.isImage && fileEntry.cdnUrl),
      onClick: (fileEntry) => {
        uploaderApi.setCurrentActivity?.(ACTIVITY_ID, {
          mode: 'edit',
          src: fileEntry.cdnUrl ?? undefined,
          internalId: fileEntry.internalId,
        });
        uploaderApi.setModalState?.(true);
      },
    });

    registry.registerActivity({
      id: ACTIVITY_ID,
      render: (host, activityParams) => {
        const params = (activityParams ?? {}) as AiEditorActivityParams;
        const editor = document.createElement('uc-ai-editor') as UcAiEditor;
        editor.mode = params.mode ?? 'generate';
        if (params.src) editor.src = params.src;
        editor.style.margin = 'auto';

        const onApply = async (e: Event) => {
          const detail = (e as CustomEvent<ApplyDetail>).detail;
          try {
            const file = await urlToFile(
              detail.url,
              detail.prompt ? `${detail.prompt.slice(0, 32).trim() || 'ai-image'}.jpg` : 'ai-image.jpg',
            );
            uploaderApi.addFileFromObject(file, { source: PLUGIN_ID });
            uploaderApi.uploadAll?.();
            uploaderApi.setCurrentActivity?.('upload-list');
          } catch (err) {
            editor.dispatchEvent(
              new CustomEvent('uc:error', { detail: { error: err }, bubbles: true, composed: true }),
            );
            // Keep the editor open so the user can retry or cancel manually.
          }
        };

        const onCancel = () => {
          uploaderApi.setCurrentActivity?.('upload-list');
        };

        editor.addEventListener('uc:apply', onApply);
        editor.addEventListener('uc:cancel', onCancel);
        host.replaceChildren(editor);

        return () => {
          editor.removeEventListener('uc:apply', onApply);
          editor.removeEventListener('uc:cancel', onCancel);
          host.replaceChildren();
        };
      },
    });
  },
};
