export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

export const ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export const resolveBackendAssetUrl = (value) => {
  if (!value || typeof value !== "string") return value;

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  return `${ASSET_BASE_URL}${value}`;
};
