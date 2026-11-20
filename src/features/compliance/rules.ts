/** Certificate scans: the `polyad-media` bucket only accepts JPG/PNG (and video). */
export const CERT_FILE = {
  types: { "image/jpeg": "jpg", "image/png": "png" },
  maxBytes: 10 * 1024 * 1024,
  label: "JPG or PNG, up to 10 MB",
} as const;
