export const formatMB = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(1)} MB`.replace("NaN", "0.0 MB");
