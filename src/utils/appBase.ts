export function getAppBaseUrl(metaUrl = import.meta.url): string {
  const moduleUrl = new URL(metaUrl);
  const assetsIndex = moduleUrl.pathname.lastIndexOf("/assets/");

  if (assetsIndex >= 0) {
    const basePath = moduleUrl.pathname.slice(0, assetsIndex);
    return `${moduleUrl.origin}${basePath}`.replace(/\/$/, "");
  }

  const configuredBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  return configuredBase.toString().replace(/\/$/, "");
}

export function getAppBasePath(metaUrl = import.meta.url): string {
  const baseUrl = new URL(getAppBaseUrl(metaUrl));
  return baseUrl.pathname.replace(/\/$/, "") || "/";
}

export function getPublicAssetUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `${getAppBaseUrl()}/${cleanPath}`;
}
