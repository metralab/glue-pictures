"use client";

import React, { SetStateAction, ChangeEvent, useState, useMemo } from "react";
import styles from "./page.module.css";
import { PagePresetKey, UploadItem } from "../lib/types";
import { formatMB } from "../lib/units";
import { PAGE_PRESETS } from "../lib/constants";
import { generatePdf } from "../lib/pdf";

interface Props {
  uploads: UploadItem[];
  setUploads: (value: SetStateAction<UploadItem[]>) => void;
  columns: number;
  setColumns: (v: SetStateAction<number>) => void;
}

export const SettingsPanel: React.FC<Props> = ({
  uploads,
  setUploads,
  columns,
  setColumns,
}) => {
  const [maxSide, setMaxSide] = useState(1600);
  const [gutter, setGutter] = useState(4);
  const [padding, setPadding] = useState(11);
  const [jpegQuality, setJpegQuality] = useState(0.85);
  const [pageSize, setPageSize] = useState<PagePresetKey>("a4");
  const [fileName, setFileName] = useState("risultato.pdf");
  const [coverText, setCoverText] = useState("");
  const [footerText, setFooterText] = useState("");

  const [isBuilding, setIsBuilding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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

  const clearAll = () => {
    setUploads((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const totalBytes = useMemo(
    () => uploads.reduce((sum, item) => sum + item.size, 0),
    [uploads],
  );

  return <section className={styles.card}>
    <div className={styles.uploadRow}>
      <label className={styles.fileLabel}>
        <input
          className={styles.fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange} />
        <span>Seleziona immagini</span>
      </label>
      <button
        className={styles.ghostButton}
        onClick={clearAll}
        disabled={!uploads.length}
        type="button"
      >
        Rimuovi immagini
      </button>
      <div className={styles.summary}>
        <span>{uploads.length} selezionate</span>
        <span>·</span>
        <span>{formatMB(totalBytes)}</span>
      </div>
    </div>

    <div className={styles.controls}>
      <div className={styles.control}>
        <label htmlFor="columns">Immagini per riga</label>
        <input
          id="columns"
          type="number"
          min={1}
          max={8}
          value={columns}
          onChange={(event) => setColumns(clampNumber(Number(event.target.value), 1, 8))} />
      </div>
      <div className={styles.control}>
        <label htmlFor="maxSide">Lato massimo immagine (px)</label>
        <input
          id="maxSide"
          type="number"
          min={400}
          max={6000}
          value={maxSide}
          onChange={(event) => setMaxSide(clampNumber(Number(event.target.value), 400, 6000))} />
        <small>Ridimensiona immagini per ottenere un PDF più leggero.</small>
      </div>
      <div className={styles.control}>
        <label htmlFor="padding">Spaziatura pagina (mm)</label>
        <input
          id="padding"
          type="number"
          min={5}
          max={30}
          value={padding}
          onChange={(event) => setPadding(clampNumber(Number(event.target.value), 5, 30))} />
      </div>
      <div className={styles.control}>
        <label htmlFor="gutter">Spazio tra celle (mm)</label>
        <input
          id="gutter"
          type="number"
          min={1}
          max={15}
          value={gutter}
          onChange={(event) => setGutter(clampNumber(Number(event.target.value), 1, 15))} />
      </div>
      <div className={styles.control}>
        <label htmlFor="quality">
          Qualità JPEG ({Math.round(jpegQuality * 100)}%)
        </label>
        <input
          id="quality"
          type="range"
          min={0.5}
          max={0.95}
          step={0.05}
          value={jpegQuality}
          onChange={(event) => setJpegQuality(Number(event.target.value))} />
      </div>
      <div className={styles.control}>
        <label htmlFor="pageSize">Dimensione pagina</label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={(event) => setPageSize(event.target.value as PagePresetKey)}
        >
          {Object.entries(PAGE_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label} ({Math.round(preset.width)}×
              {Math.round(preset.height)} mm)
            </option>
          ))}
        </select>
      </div>
      <div className={styles.control}>
        <label htmlFor="fileName">Nome PDF</label>
        <input
          id="fileName"
          type="text"
          value={fileName}
          onChange={(event) => setFileName(event.target.value)} />
        <small>.pdf verrà aggiunto se mancante.</small>
      </div>
      <hr className={styles.separator} />
      <div className={styles.control}>
        <label htmlFor="coverText">Testo copertina</label>
        <input
          id="coverText"
          type="text"
          value={coverText}
          onChange={(event) => setCoverText(event.target.value)} />
        <small>Campo facoltativo.</small>
      </div>
      <div className={styles.control}>
        <label htmlFor="footerText">Testo a piè di pagina</label>
        <input
          id="footerText"
          type="text"
          value={footerText}
          onChange={(event) => setFooterText(event.target.value)} />
        <small>Campo facoltativo.</small>
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
          coverText,
          footerText,
        })}
        disabled={!uploads.length || isBuilding}
      >
        {isBuilding ? "Generazione..." : "Genera PDF"}
      </button>
      {status && <p className={styles.status}>{status}</p>}
    </div>
  </section>;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
