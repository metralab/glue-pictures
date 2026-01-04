"use client";

import React from "react";
import styles from "./page.module.css";

export const MainHeader: React.FC = () =>
  <header className={styles.header}>
    <div>
      <h1>Ottieni un PDF con immagini disposte in griglia</h1>
      <p className={styles.lead}>
        Seleziona più immagini &#8594; imposta la griglia &#8594; clicca &ldquo;Genera PDF&rdquo;.
      </p>
    </div>
  </header>;
