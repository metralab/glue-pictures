"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import styles from "./page.module.css";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
};

type PagePresetKey = "a4" | "letter";

const PAGE_PRESETS: Record<
  PagePresetKey,
  { width: number; height: number; label: string }
> = {
  a4: { width: 595.28, height: 841.89, label: "A4" },
  letter: { width: 612, height: 792, label: "Letter" },
};

const formatMB = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(1)} MB`.replace("NaN", "0.0 MB");

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type DrawableImage = ImageBitmap | HTMLImageElement;

async function loadDrawableImage(
  file: File,
): Promise<{ image: DrawableImage; revoke?: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap };
  }

  const url = URL.createObjectURL(file);
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ image: img, revoke: () => URL.revokeObjectURL(url) });
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
}

async function downscaleForPdf(file: File, maxSide: number, quality: number) {
  const { image, revoke } = await loadDrawableImage(file);
  const width = (image as any).width as number;
  const height = (image as any).height as number;
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * ratio));
  const targetHeight = Math.max(1, Math.round(height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    revoke?.();
    throw new Error("Canvas not supported in this browser.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) {
          resolve(value);
        } else {
          reject(new Error("Unable to encode image."));
        }
      },
      mimeType,
      mimeType === "image/jpeg" ? quality : undefined,
    );
  });

  if ("close" in image && typeof (image as ImageBitmap).close === "function") {
    (image as ImageBitmap).close();
  }
  revoke?.();

  const arrayBuffer = await blob.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuffer),
    width: targetWidth,
    height: targetHeight,
    mimeType,
  };
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function Home() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [columns, setColumns] = useState(3);
  const [maxSide, setMaxSide] = useState(1600);
  const [gutter, setGutter] = useState(12);
  const [padding, setPadding] = useState(32);
  const [jpegQuality, setJpegQuality] = useState(0.85);
  const [pageSize, setPageSize] = useState<PagePresetKey>("a4");
  const [status, setStatus] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [fileName, setFileName] = useState("images.pdf");
  const uploadsRef = useRef<UploadItem[]>([]);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(
    () => () => {
      uploadsRef.current.forEach((upload) =>
        URL.revokeObjectURL(upload.previewUrl),
      );
    },
    [],
  );

  const totalBytes = useMemo(
    () => uploads.reduce((sum, item) => sum + item.size, 0),
    [uploads],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    const next = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      }));

    setUploads((current) => [...current, ...next]);
    event.target.value = "";
  };

  const removeImage = (id: string) => {
    setUploads((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const clearAll = () => {
    setUploads((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const gridPreviewColumns = useMemo(() => {
    return Math.min(columns, 6);
  }, [columns]);

  const generatePdf = async () => {
    if (!uploads.length || isBuilding) return;
    setIsBuilding(true);
    setStatus("Preparing images...");

    try {
      const preset = PAGE_PRESETS[pageSize];
      const pageWidth = preset.width;
      const pageHeight = preset.height;

      const safeColumns = Math.max(1, columns);
      const cellWidth = Math.max(
        40,
        (pageWidth - padding * 2 - gutter * (safeColumns - 1)) / safeColumns,
      );
      const cellHeight = cellWidth;
      const rowsPerPage = Math.max(
        1,
        Math.floor((pageHeight - padding * 2 + gutter) / (cellHeight + gutter)),
      );

      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let col = 0;
      let row = 0;

      for (let i = 0; i < uploads.length; i++) {
        const upload = uploads[i];
        setStatus(`Optimizing image ${i + 1} of ${uploads.length}...`);
        const processed = await downscaleForPdf(upload.file, maxSide, jpegQuality);
        const embedded =
          processed.mimeType === "image/png"
            ? await pdfDoc.embedPng(processed.bytes)
            : await pdfDoc.embedJpg(processed.bytes);

        if (row >= rowsPerPage) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          row = 0;
          col = 0;
        }

        const x = padding + col * (cellWidth + gutter);
        const baseY = pageHeight - padding - cellHeight - row * (cellHeight + gutter);
        const scale = Math.min(
          cellWidth / embedded.width,
          cellHeight / embedded.height,
        );
        const drawWidth = embedded.width * scale;
        const drawHeight = embedded.height * scale;

        page.drawImage(embedded, {
          x: x + (cellWidth - drawWidth) / 2,
          y: baseY + (cellHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });

        col += 1;
        if (col >= safeColumns) {
          col = 0;
          row += 1;
        }
      }

      setStatus("Building PDF...");
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const cleanedName = fileName.trim().length ? fileName.trim() : "images.pdf";
      link.download = cleanedName.endsWith(".pdf")
        ? cleanedName
        : `${cleanedName}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`PDF ready (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB).`);
    } catch (error) {
      console.error(error);
      setStatus(
        "Unable to build the PDF. Try lowering the max side or number of columns.",
      );
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Glue your pictures together</p>
            <h1>Upload many images, get a tidy PDF.</h1>
            <p className={styles.lead}>
              Drop in a large batch of photos, pick how wide the grid should be,
              and we will resize the images on the fly before packing them into a
              PDF.
            </p>
          </div>
          <div className={styles.badges}>
            <span className={styles.badge}>Handles big batches</span>
            <span className={styles.badge}>Client-side only</span>
          </div>
        </header>

        <section className={styles.card}>
          <div className={styles.uploadRow}>
            <label className={styles.fileLabel}>
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
              />
              <span>Select images</span>
            </label>
            <button
              className={styles.ghostButton}
              onClick={clearAll}
              disabled={!uploads.length}
              type="button"
            >
              Clear list
            </button>
            <div className={styles.summary}>
              <span>{uploads.length} selected</span>
              <span>·</span>
              <span>{formatMB(totalBytes)}</span>
            </div>
          </div>

          <div className={styles.controls}>
            <div className={styles.control}>
              <label htmlFor="columns">Images per row</label>
              <input
                id="columns"
                type="number"
                min={1}
                max={8}
                value={columns}
                onChange={(event) =>
                  setColumns(clampNumber(Number(event.target.value), 1, 8))
                }
              />
            </div>
            <div className={styles.control}>
              <label htmlFor="maxSide">Max image side (px)</label>
              <input
                id="maxSide"
                type="number"
                min={400}
                max={6000}
                value={maxSide}
                onChange={(event) =>
                  setMaxSide(clampNumber(Number(event.target.value), 400, 6000))
                }
              />
              <small>Downscale before embedding to keep PDFs lean.</small>
            </div>
            <div className={styles.control}>
              <label htmlFor="padding">Page padding (pt)</label>
              <input
                id="padding"
                type="number"
                min={12}
                max={72}
                value={padding}
                onChange={(event) =>
                  setPadding(clampNumber(Number(event.target.value), 12, 72))
                }
              />
            </div>
            <div className={styles.control}>
              <label htmlFor="gutter">Cell gap (pt)</label>
              <input
                id="gutter"
                type="number"
                min={4}
                max={32}
                value={gutter}
                onChange={(event) =>
                  setGutter(clampNumber(Number(event.target.value), 4, 32))
                }
              />
            </div>
            <div className={styles.control}>
              <label htmlFor="quality">
                JPEG quality ({Math.round(jpegQuality * 100)}%)
              </label>
              <input
                id="quality"
                type="range"
                min={0.5}
                max={0.95}
                step={0.05}
                value={jpegQuality}
                onChange={(event) => setJpegQuality(Number(event.target.value))}
              />
            </div>
            <div className={styles.control}>
              <label htmlFor="pageSize">Page size</label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value as PagePresetKey)}
              >
                {Object.entries(PAGE_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label} ({Math.round(preset.width)}×
                    {Math.round(preset.height)} pt)
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.control}>
              <label htmlFor="fileName">Output name</label>
              <input
                id="fileName"
                type="text"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
              />
              <small>.pdf will be added if missing.</small>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={generatePdf}
              disabled={!uploads.length || isBuilding}
            >
              {isBuilding ? "Generating..." : "Generate PDF"}
            </button>
            {status && <p className={styles.status}>{status}</p>}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.previewHeader}>
            <div>
              <p className={styles.kicker}>Preview grid</p>
              <h2>What will land in the PDF</h2>
            </div>
            <p className={styles.previewHint}>
              Showing up to {gridPreviewColumns} columns here. The PDF uses your full
              settings.
            </p>
          </div>
          {uploads.length === 0 ? (
            <div className={styles.empty}>
              <p>Start by adding images. Previews will appear here.</p>
            </div>
          ) : (
            <div
              className={styles.previewGrid}
              style={{
                gridTemplateColumns: `repeat(${gridPreviewColumns}, minmax(0, 1fr))`,
              }}
            >
              {uploads.map((upload) => (
                <div key={upload.id} className={styles.thumb}>
                  <img src={upload.previewUrl} alt={upload.name} loading="lazy" />
                  <div className={styles.thumbMeta}>
                    <div className={styles.thumbText}>
                      <strong>{upload.name}</strong>
                      <span>{formatMB(upload.size)}</span>
                    </div>
                    <button
                      className={styles.remove}
                      type="button"
                      onClick={() => removeImage(upload.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
