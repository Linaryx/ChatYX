import { CHAT_CONFIG_QUERY_KEYS, isValidChatConfigImport } from "./chatUrlParams";
import {
  CHATIS_UNIQUE_KEYS,
  COMMON_KEYS,
  mapChatIsParams,
  mapChatYxParams,
  mapSharedParams,
  SHARED_UNIQUE_KEYS,
  type DetectedSetupImportSource,
  type SetupImportMapping,
  type SetupImportPatch,
  type SetupImportSource,
} from "./setupImportMapping";

export type { SetupImportPatch, SetupImportSource } from "./setupImportMapping";

export type SetupImportResult =
  | {
      readonly kind: "parsed";
      readonly source: DetectedSetupImportSource;
      readonly sourceLabel: "ChatYX" | "ChatIS" | "Cyan Chat" | "Davii Chat";
      readonly patch: SetupImportPatch;
      readonly unsupported: readonly string[];
    }
  | { readonly kind: "ambiguous" }
  | { readonly kind: "unrecognized" };

const HOST_SOURCES: Readonly<Record<string, DetectedSetupImportSource>> = {
  "chat.ruina.team": "chatyx",
  "chatis.is2511.com": "chatis",
  "chat.johnnycyan.com": "cyan",
  "chatsemban.justdavi.dev": "davii",
  "unificado.justdavi.dev": "davii",
};

function sourceLabel(source: DetectedSetupImportSource): "ChatYX" | "ChatIS" | "Cyan Chat" | "Davii Chat" {
  switch (source) {
    case "chatyx": return "ChatYX";
    case "chatis": return "ChatIS";
    case "cyan": return "Cyan Chat";
    case "davii": return "Davii Chat";
    default: return source satisfies never;
  }
}

function hasAny(params: URLSearchParams, keys: readonly string[]): boolean {
  return keys.some((key) => params.has(key));
}

function mappingFor(source: DetectedSetupImportSource, params: URLSearchParams): SetupImportMapping {
  switch (source) {
    case "chatyx": return isValidChatConfigImport(params)
      ? mapChatYxParams(params)
      : { patch: {}, unsupported: [] };
    case "chatis": return mapChatIsParams(params);
    case "cyan": return mapSharedParams(params);
    case "davii": return mapSharedParams(params);
    default: return source satisfies never;
  }
}

function parsedResult(
  source: DetectedSetupImportSource,
  mapping: SetupImportMapping,
): SetupImportResult {
  if (Object.keys(mapping.patch).length === 0 && mapping.unsupported.length === 0) {
    return { kind: "unrecognized" };
  }
  return {
    kind: "parsed",
    source,
    sourceLabel: sourceLabel(source),
    patch: mapping.patch,
    unsupported: mapping.unsupported,
  };
}

export function parseSetupImport(
  rawInput: string,
  selectedSource: SetupImportSource,
  currentOrigin?: string,
): SetupImportResult {
  const input = rawInput.trim();
  if (!input) return { kind: "unrecognized" };

  const isUrl = URL.canParse(input);
  const url = isUrl ? new URL(input) : undefined;
  if (url && (!["http:", "https:"].includes(url.protocol) || url.username || url.password)) {
    return { kind: "unrecognized" };
  }
  const query = url?.search.slice(1) ?? input.replace(/^\?/, "");
  if (!query || query.split("&").some((part) => !/^[a-zA-Z_][a-zA-Z0-9_]*=[^#]*$/.test(part))) {
    return { kind: "unrecognized" };
  }
  try {
    decodeURIComponent(query.replace(/\+/g, " "));
  } catch {
    return { kind: "unrecognized" };
  }
  const params = url?.searchParams ?? new URLSearchParams(query);

  if (selectedSource !== "auto") {
    return parsedResult(selectedSource, mappingFor(selectedSource, params));
  }
  if (url) {
    // A self-hosted instance is trusted only at the exact origin supplied by the UI.
    const detected = (Object.hasOwn(HOST_SOURCES, url.hostname) ? HOST_SOURCES[url.hostname] : undefined)
      ?? (url.hostname === "linaryx.github.io" && /^\/ChatYX(?:\/|$)/.test(url.pathname) ? "chatyx" : undefined)
      ?? (url.origin === currentOrigin ? "chatyx" : undefined);
    return detected ? parsedResult(detected, mappingFor(detected, params)) : { kind: "unrecognized" };
  }

  const hasChatIs = hasAny(params, CHATIS_UNIQUE_KEYS);
  const hasShared = hasAny(params, SHARED_UNIQUE_KEYS);
  if (hasAny(params, CHAT_CONFIG_QUERY_KEYS)) return { kind: "ambiguous" };
  if (hasChatIs && !hasShared) return parsedResult("chatis", mapChatIsParams(params));
  if (hasShared && !hasChatIs) return { kind: "ambiguous" };
  if (hasChatIs || hasShared || hasAny(params, COMMON_KEYS)) return { kind: "ambiguous" };
  return { kind: "unrecognized" };
}
