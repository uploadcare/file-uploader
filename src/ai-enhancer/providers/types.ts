import type { AiCapability } from '../capabilities';

export type AiProviderRequest = {
  prompt: string;
  capability: AiCapability;
  sourceUrl?: string;
  signal?: AbortSignal;
};

export type AiProviderResult = {
  url: string;
  prompt: string;
  capability: AiCapability;
};

export type AiProvider = {
  id: string;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
};
