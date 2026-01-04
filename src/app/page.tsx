"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { UploadItem } from "./lib/types";
import { GridPreview } from "./components/GridPreview";
import { SettingsPanel } from "./components/SettingsPanel";
import { MainHeader } from "./components/MainHeader";

export default function Home() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [columns, setColumns] = useState(3);
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

  const removeImage = (id: string) => {
    setUploads((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const gridPreviewColumns = useMemo(() => {
    return Math.min(columns, 6);
  }, [columns]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <MainHeader />
        <SettingsPanel
          uploads={uploads}
          setUploads={setUploads}
          columns={columns}
          setColumns={setColumns}
        />
        <GridPreview
          uploads={uploads}
          gridPreviewColumns={gridPreviewColumns}
          removeImage={removeImage}
        />
      </main>
    </div>
  );
}
