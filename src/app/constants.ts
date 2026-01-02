import { PagePresetKey } from "./types";

export const PAGE_PRESETS: Record<
    PagePresetKey, { width: number; height: number; label: string; }
> = {
    a4: { width: 595.28, height: 841.89, label: "A4" },
    letter: { width: 612, height: 792, label: "Letter" },
};
