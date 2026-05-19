export {
  type AiCapability,
  type AiEditorMode,
  type AiTemplate,
  CAPABILITIES,
  CAPABILITIES_FOR_MODE,
  type CapabilityMeta,
} from './capabilities';
export { GenerationController } from './controllers/GenerationController';
export { enLocale } from './locales/en';
export { translate } from './locales/translate';
export { type AiEditorActivityParams, AiEnhancerPlugin } from './plugin/AiEnhancerPlugin';
export { createMockBflProvider, type MockBflOptions, mockBflProvider } from './providers/mockBfl';
export type { AiProvider, AiProviderRequest, AiProviderResult } from './providers/types';
export type { ApplyDetail, HistoryEntry } from './UcAiEditor';
export { UcAiEditor } from './UcAiEditor';

// Sub-elements (also auto-registered when imported)
export { UcAiCanvas } from './ui/parts/UcAiCanvas';
export { type TemplateSelectDetail, UcAiChips } from './ui/parts/UcAiChips';
export { UcAiFooter } from './ui/parts/UcAiFooter';
export { type HistorySelectDetail, UcAiHistoryPopover } from './ui/parts/UcAiHistoryPopover';
export { type PromptInputDetail, UcAiPromptRow } from './ui/parts/UcAiPromptRow';
