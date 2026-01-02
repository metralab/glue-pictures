"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { PagePresetKey, UploadItem } from "./types";
import { PAGE_PRESETS } from "./constants";
import { generatePdf } from "./pdf";

const formatMB = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(1)} MB`.replace("NaN", "0.0 MB");

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

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
              onClick={async () => await generatePdf({
                uploads,
                isBuilding,
                setIsBuilding,
                setStatus,
                pageSize,
                columns,
                padding,
                gutter,
                maxSide,
                jpegQuality,
                fileName,
              })}
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
