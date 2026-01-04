"use client";

import React from "react";
import styles from "./page.module.css";
import { UploadItem } from "../lib/types";
import { formatMB } from "../lib/units";

interface Props {
  uploads: UploadItem[];
  gridPreviewColumns: number;
  removeImage: (id: string) => void;
}

export const GridPreview: React.FC<Props> = ({
  uploads,
  gridPreviewColumns,
  removeImage,
}) =>
  <section className={styles.card}>
    <div className={styles.previewHeader}>
      <h2>Cosa finirà nel PDF</h2>
      <p className={styles.previewHint}>
        Anteprima della griglia (non usa tutti i parametri impostati sopra)
      </p>
    </div>
    {uploads.length === 0 ? (
      <div className={styles.empty}>
        <p>Aggiungi immagini. Le anteprime appariranno qui.</p>
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
                Rimuovi
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>;
