export const UID = {
  generate(): string {
    return `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  },
};
