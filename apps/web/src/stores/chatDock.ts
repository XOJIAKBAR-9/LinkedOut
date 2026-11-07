import { create } from "zustand";

/** Small chat windows docked at the bottom-right, like a messenger overlay. */
interface ChatDockState {
  open: string[]; // conversation ids, newest last
  minimized: Record<string, boolean>;
  openChat: (id: string) => void;
  closeChat: (id: string) => void;
  toggleMinimize: (id: string) => void;
}

const MAX_OPEN = 3;

export const useChatDock = create<ChatDockState>((set) => ({
  open: [],
  minimized: {},
  openChat: (id) =>
    set((s) => ({
      open: [...s.open.filter((x) => x !== id), id].slice(-MAX_OPEN),
      minimized: { ...s.minimized, [id]: false },
    })),
  closeChat: (id) => set((s) => ({ open: s.open.filter((x) => x !== id) })),
  toggleMinimize: (id) => set((s) => ({ minimized: { ...s.minimized, [id]: !s.minimized[id] } })),
}));
