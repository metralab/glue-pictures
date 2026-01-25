import { PDFDocument, StandardFonts, PDFImage } from "pdf-lib";
import { PAGE_PRESETS } from "./constants";
import { DrawableImage, PagePresetKey, UploadItem } from "./types";

interface Args {
  uploads: UploadItem[];
  isBuilding: boolean;
  setIsBuilding: (v: boolean) => void;
  setStatus: (v: string) => void;
  pageSize: PagePresetKey;
  columns: number;
  verticalPadding: number;
  leftPadding: number;
  rightPadding: number;
  gutter: number;
  maxSide: number;
  jpegQuality: number;
  fileName: string;
  headerText: string;
  footerText: string;
  startingPageNumber: number;
  logo?: File;
}

export const generatePdf: (args: Args) => Promise<void> = async ({
  uploads,
  isBuilding,
  setIsBuilding,
  setStatus,
  pageSize,
  columns,
  verticalPadding,
  leftPadding,
  rightPadding,
  gutter,
  maxSide,
  jpegQuality,
  fileName,
  headerText,
  footerText,
  startingPageNumber,
  logo,
}) => {
  if (!uploads.length || isBuilding) return;
  setIsBuilding(true);
  setStatus("Preparazione...");

  try {
    const PT_PER_MM = 72 / 25.4;
    const preset = PAGE_PRESETS[pageSize];
    const pageWidth = preset.width * PT_PER_MM;
    const pageHeight = preset.height * PT_PER_MM;
    const verticalPaddingPt = verticalPadding * PT_PER_MM;
    const leftPaddingPt = leftPadding * PT_PER_MM;
    const rightPaddingPt = rightPadding * PT_PER_MM;
    const gutterPt = gutter * PT_PER_MM;

    const headerSpace = headerText.trim() ? 40 : 0; // pt

    const safeColumns = Math.max(1, columns);
    const cellWidth = Math.max(
      40,
      (pageWidth - leftPaddingPt - rightPaddingPt - gutterPt * (safeColumns - 1)) / safeColumns,
    );
    const cellHeight = cellWidth;
    const rowsPerPage = Math.max(
      1,
      Math.floor((pageHeight - headerSpace - verticalPaddingPt * 2 + gutterPt) / (cellHeight + gutterPt)),
    );

    const pdfDoc = await PDFDocument.create();
    const font = pdfDoc.embedStandardFont(StandardFonts.Helvetica);
    const fontSize = 10;
    const textPadding = 5;

    let embeddedLogo: PDFImage | null = null;
    if (logo) {
      setStatus("Elaborazione logo...");
      const processedLogo = await downscaleForPdf(logo, 500, 0.95);
      embeddedLogo = processedLogo.mimeType === "image/png"
        ? await pdfDoc.embedPng(processedLogo.bytes)
        : await pdfDoc.embedJpg(processedLogo.bytes);
    }

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let col = 0;
    let row = 0;

    for (let i = 0; i < uploads.length; i++) {
      const upload = uploads[i];
      setStatus(`Immagine ${i + 1} di ${uploads.length}...`);
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

      const x = leftPaddingPt + col * (cellWidth + gutterPt);
      const baseY = (pageHeight - headerSpace) - verticalPaddingPt - cellHeight - row * (cellHeight + gutterPt);
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

      // Draw image title as caption
      const text = upload.file.name.replace(/\.[^/.]+$/, "");
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textX = x + (cellWidth - textWidth) / 2;
      const textY = baseY + (cellHeight - drawHeight) / 2 - fontSize - textPadding;
      page.drawText(text, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
      });

      col += 1;
      if (col >= safeColumns) {
        col = 0;
        row += 1;
      }
    }

    const allPages = pdfDoc.getPages();
    const headerTextExists = headerText.trim();
    const footerTextExists = footerText.trim();
    allPages.forEach((page, index) => {
      if (footerTextExists) {
        const footerFontSize = 8;
        const footerY = 20;
        const textWidth = font.widthOfTextAtSize(footerText, footerFontSize);
        const availableWidth = pageWidth - leftPaddingPt - rightPaddingPt;
        const textX = leftPaddingPt + (availableWidth - textWidth) / 2;
        page.drawText(footerText, {
          x: textX,
          y: footerY,
          size: footerFontSize,
          font,
        });
      }

      if (headerTextExists) {
        const headerFontSize = 8;
        const headerY = pageHeight - 20;
        const textWidth = font.widthOfTextAtSize(headerText, headerFontSize);
        let logoWidth = 0;
        let logoHeight = 0;
        if (embeddedLogo) {
          const scale = (headerFontSize * 3) / embeddedLogo.height;
          logoWidth = embeddedLogo.width * scale;
          logoHeight = embeddedLogo.height * scale;
        }
        const padding = 5; // pt
        const totalWidth = logoWidth + (logoWidth > 0 ? padding : 0) + textWidth;
        const availableWidth = pageWidth - leftPaddingPt - rightPaddingPt;
        const startX = leftPaddingPt + (availableWidth - totalWidth) / 2;
        if (embeddedLogo) {
          page.drawImage(embeddedLogo, {
            x: startX,
            y: headerY - logoHeight / 2,
            width: logoWidth,
            height: logoHeight,
          });
        }
        const textX = startX + logoWidth + (logoWidth > 0 ? padding : 0);
        page.drawText(headerText, {
          x: textX,
          y: headerY,
          size: headerFontSize,
          font,
        });
      }

      // Page numbering
      const pageNumber = startingPageNumber + index;
      const pageNumberText = pageNumber.toString();
      const pageNumberFontSize = 8;
      const pageNumberWidth = font.widthOfTextAtSize(pageNumberText, pageNumberFontSize);
      const pageNumberX = pageWidth - pageNumberWidth - 20;
      const pageNumberY = 20;
      page.drawText(pageNumberText, {
        x: pageNumberX,
        y: pageNumberY,
        size: pageNumberFontSize,
        font,
      });
    });

    setStatus("Sto generando il PDF...");
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const cleanedName = fileName.trim().length ? fileName.trim() : "risultato.pdf";
    link.download = cleanedName.endsWith(".pdf")
      ? cleanedName
      : `${cleanedName}.pdf`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`PDF pronto (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB).`);
  } catch (error) {
    console.error(error);
    setStatus(
      "Non è stato possibile generare il PDF. Prova a ridurre il lato massimo immagine o il numero di colonne.",
    );
  } finally {
    setIsBuilding(false);
  }
};

async function downscaleForPdf(file: File, maxSide: number, quality: number) {
  const { image, revoke } = await loadDrawableImage(file);
  const width = image.width;
  const height = image.height;
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
