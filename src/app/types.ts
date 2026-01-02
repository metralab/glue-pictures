export type UploadItem = {
    id: string;
    file: File;
    previewUrl: string;
    name: string;
    size: number;
};

export type PagePresetKey = "a4" | "letter";

export type DrawableImage = ImageBitmap | HTMLImageElement;
