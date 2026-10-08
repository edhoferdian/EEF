import { create } from 'zustand';

export const useSettings = create((set) => ({
  draft: { theme: 'light', saved: false },
  setDraft: (draft) => set({ draft }),
  reset: (settings) => set({ draft: { ...settings, saved: false } }),
  save: async (draft) => {
    await fetch('/api/settings', { method: 'PUT', body: JSON.stringify(draft) });
  },
}));
