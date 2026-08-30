import type { Badge } from "~/services/badges/badgeService";
import type { Paint } from "./sevenTVPaintService";

const RTE_API_BASE = "https://ext.rte.net.ru:8443/api";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export interface RteCosmeticsLoader {
  loadBadge(userId: string): Promise<Badge | null>;
  loadPaint(userId: string): Promise<Paint | null>;
}
type ParseResult<T> =
  | { readonly kind: "value"; readonly value: T }
  | { readonly kind: "empty" }
  | { readonly kind: "invalid" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  value: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function parseHttpsUrl(value: string | null): string | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password
    ? url.toString()
    : null;
}

function parseBadge(value: unknown): ParseResult<Badge> {
  if (value === null || value === undefined) return { kind: "empty" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "empty" };
    for (const item of value) {
      const parsed = parseBadge(item);
      if (parsed.kind === "value") return parsed;
    }
    return { kind: "invalid" };
  }
  if (!isRecord(value)) return { kind: "invalid" };
  if (Object.keys(value).length === 0) return { kind: "empty" };

  const url = parseHttpsUrl(
    stringField(value, [
      "url",
      "badge_url",
      "badgeUrl",
      "image",
      "image_url",
      "imageUrl",
      "icon",
    ]),
  );
  if (url) {
    return {
      kind: "value",
      value: {
        source: "rte-reyohoho",
        description:
          stringField(value, ["description", "tooltip", "title", "name"]) ??
          "Reyohoho",
        url,
      },
    };
  }

  for (const key of ["data", "badge", "badges"] as const) {
    if (key in value) return parseBadge(value[key]);
  }
  return { kind: "invalid" };
}

function parseStops(value: unknown): Array<{ at: number; color: number }> | null {
  if (!Array.isArray(value)) return null;
  const stops: Array<{ at: number; color: number }> = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.at !== "number" || typeof item.color !== "number") {
      return null;
    }
    stops.push({ at: item.at, color: item.color });
  }
  return stops;
}

function parseShadows(
  value: unknown,
): Paint["shadows"] | null {
  if (!Array.isArray(value)) return null;
  const shadows: NonNullable<Paint["shadows"]> = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.x_offset !== "number" ||
      typeof item.y_offset !== "number" ||
      typeof item.radius !== "number" ||
      typeof item.color !== "number"
    ) {
      return null;
    }
    shadows.push({
      x_offset: item.x_offset,
      y_offset: item.y_offset,
      radius: item.radius,
      color: item.color,
    });
  }
  return shadows;
}

function parsePaint(value: unknown): ParseResult<Paint> {
  if (!isRecord(value)) return value === null ? { kind: "empty" } : { kind: "invalid" };
  if (value.has_paint === false || value.paint_id === null) return { kind: "empty" };

  const candidate = isRecord(value.paint) ? value.paint : value;
  const id = stringField(candidate, ["id"]) ?? stringField(value, ["paint_id"]);
  const functionName = stringField(candidate, ["function"]);
  const color = candidate.color === null || typeof candidate.color === "number"
    ? candidate.color
    : null;
  const stops = parseStops(candidate.stops);
  const shadows = candidate.shadows === undefined
    ? []
    : parseShadows(candidate.shadows);
  if (!id || !functionName || color === null && candidate.color !== null || !stops || !shadows) {
    return { kind: "invalid" };
  }

  const paint: Paint = {
    id,
    name: stringField(candidate, ["name"]) ?? "RTE Paint",
    function: functionName,
    color,
    stops,
    shadows,
  };
  if (typeof candidate.angle === "number") paint.angle = candidate.angle;
  if (typeof candidate.shape === "string") paint.shape = candidate.shape;
  const imageUrl = parseHttpsUrl(stringField(candidate, ["image_url", "imageUrl"]));
  if (imageUrl) paint.image_url = imageUrl;
  return { kind: "value", value: paint };
}

export class RteCosmeticsService {
  private readonly badgeCache = new Map<string, Badge | null>();
  private readonly paintCache = new Map<string, Paint | null>();

  constructor(
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}

  loadBadge(userId: string): Promise<Badge | null> {
    return this.load(
      userId,
      this.badgeCache,
      `${RTE_API_BASE}/badge-users/${encodeURIComponent(userId)}`,
      parseBadge,
    );
  }

  loadPaint(userId: string): Promise<Paint | null> {
    return this.load(
      userId,
      this.paintCache,
      `${RTE_API_BASE}/paint/${encodeURIComponent(userId)}`,
      parsePaint,
    );
  }

  clear(): void {
    this.badgeCache.clear();
    this.paintCache.clear();
  }

  private async load<T>(
    userId: string,
    cache: Map<string, T | null>,
    url: string,
    parse: (value: unknown) => ParseResult<T>,
  ): Promise<T | null> {
    if (cache.has(userId)) return cache.get(userId) ?? null;

    try {
      const response = await this.fetcher(url, { credentials: "omit" });
      if (response.status === 204) {
        cache.set(userId, null);
        return null;
      }
      if (!response.ok) return null;

      const parsed = parse(await response.json());
      if (parsed.kind === "invalid") return null;
      const result = parsed.kind === "value" ? parsed.value : null;
      cache.set(userId, result);
      return result;
    } catch (error) {
      if (error instanceof Error) return null;
      throw error;
    }
  }
}

export const rteCosmeticsService = new RteCosmeticsService();
