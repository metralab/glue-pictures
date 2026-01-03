import { PagePresetKey } from "./types";

export const PAGE_PRESETS: Record<
    PagePresetKey, { width: number; height: number; label: string; }
> = {
    a4: { width: 210, height: 297, label: "A4" },
    letter: { width: 216, height: 279, label: "Letter" },
};
