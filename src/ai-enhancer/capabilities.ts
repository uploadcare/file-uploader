export type AiCapability = 'generate' | 'object-remove' | 'bg-replace' | 'outpaint';

export type AiEditorMode = 'generate' | 'edit';

export type AiTemplate = {
  label: string;
  prompt: string;
  capability: AiCapability;
};

export type CapabilityMeta = {
  id: AiCapability;
  mode: AiEditorMode;
  labelKey: string;
  placeholderKey: string;
  templates: AiTemplate[];
};

export const CAPABILITIES: Record<AiCapability, CapabilityMeta> = {
  generate: {
    id: 'generate',
    mode: 'generate',
    labelKey: 'ai-enhancer-capability-generate',
    placeholderKey: 'ai-enhancer-generate-placeholder',
    templates: [
      { label: 'Photorealistic', prompt: 'A photorealistic ', capability: 'generate' },
      { label: 'Illustration', prompt: 'A flat illustration of ', capability: 'generate' },
      { label: 'Cinematic', prompt: 'Cinematic shot of ', capability: 'generate' },
      { label: 'Watercolor', prompt: 'A soft watercolor painting of ', capability: 'generate' },
      { label: 'Surprise me', prompt: '', capability: 'generate' },
    ],
  },
  'object-remove': {
    id: 'object-remove',
    mode: 'edit',
    labelKey: 'ai-enhancer-capability-object-remove',
    placeholderKey: 'ai-enhancer-edit-placeholder',
    templates: [
      { label: 'Remove people', prompt: 'Remove all people from the scene', capability: 'object-remove' },
      { label: 'Clean up', prompt: 'Remove clutter', capability: 'object-remove' },
      { label: 'Add a clown nose', prompt: 'Add a clown nose to the subject', capability: 'object-remove' },
    ],
  },
  'bg-replace': {
    id: 'bg-replace',
    mode: 'edit',
    labelKey: 'ai-enhancer-capability-bg-replace',
    placeholderKey: 'ai-enhancer-edit-placeholder',
    templates: [
      { label: 'White studio', prompt: 'Replace background with a white studio backdrop', capability: 'bg-replace' },
      { label: 'Beach', prompt: 'Replace background with a sunny beach', capability: 'bg-replace' },
      { label: 'Remove bg', prompt: 'Remove the background entirely', capability: 'bg-replace' },
    ],
  },
  outpaint: {
    id: 'outpaint',
    mode: 'edit',
    labelKey: 'ai-enhancer-capability-outpaint',
    placeholderKey: 'ai-enhancer-edit-placeholder',
    templates: [
      { label: 'To 9:16', prompt: 'Extend to vertical 9:16 aspect ratio', capability: 'outpaint' },
      { label: 'To 16:9', prompt: 'Extend to horizontal 16:9 aspect ratio', capability: 'outpaint' },
      { label: 'To square', prompt: 'Extend to a 1:1 square', capability: 'outpaint' },
    ],
  },
};

export const CAPABILITIES_FOR_MODE: Record<AiEditorMode, AiCapability[]> = {
  generate: ['generate'],
  edit: ['object-remove', 'bg-replace', 'outpaint'],
};
