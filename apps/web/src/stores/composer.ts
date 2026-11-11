import type { PostType } from "@linkedout/shared";
import { create } from "zustand";

/** Lets sidebars, empty states and shortcuts open the feed composer at a given post type. */
interface ComposerState {
  open: boolean;
  type: PostType;
  /** Increments on every request so the composer can scroll into view and focus again. */
  nonce: number;
  openWith: (type: PostType) => void;
  setType: (type: PostType) => void;
  close: () => void;
}

export const useComposer = create<ComposerState>((set) => ({
  open: false,
  type: "UPDATE",
  nonce: 0,
  openWith: (type) => set((s) => ({ open: true, type, nonce: s.nonce + 1 })),
  setType: (type) => set({ type }),
  close: () => set({ open: false, type: "UPDATE" }),
}));
