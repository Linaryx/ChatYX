import {
  CHATIS_UNIQUE_KEYS,
  COMMON_KEYS,
  mapChatIsParams,
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
      readonly sourceLabel: "ChatIS" | "Cyan Chat" | "Davii Chat";
      readonly patch: SetupImportPatch;
      readonly unsupported: readonly string[];
    }
  | { readonly kind: "ambiguous" }
  | { readonly kind: "unrecognized" };

const HOST_SOURCES: Readonly<Record<string, DetectedSetupImportSource>> = {
  "chatis.is2511.com": "chatis",
  "chat.johnnycyan.com": "cyan",
  "chatsemban.justdavi.dev": "davii",
  "unificado.justdavi.dev": "davii",
};

function sourceLabel(source: DetectedSetupImportSource): "ChatIS" | "Cyan Chat" | "Davii Chat" {
  switch (source) {
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

export function parseSetupImport(rawInput: string, selectedSource: SetupImportSource): SetupImportResult {
  const input = rawInput.trim();
  if (!input) return { kind: "unrecognized" };

  const isUrl = URL.canParse(input);
  const url = isUrl ? new URL(input) : undefined;
  const params = url?.searchParams ?? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);

  if (selectedSource !== "auto") {
    return parsedResult(selectedSource, mappingFor(selectedSource, params));
  }
  if (url) {
    const detected = HOST_SOURCES[url.hostname.toLowerCase()];
    return detected ? parsedResult(detected, mappingFor(detected, params)) : { kind: "unrecognized" };
  }

  const hasChatIs = hasAny(params, CHATIS_UNIQUE_KEYS);
  const hasShared = hasAny(params, SHARED_UNIQUE_KEYS);
  if (hasChatIs && !hasShared) return parsedResult("chatis", mapChatIsParams(params));
  if (hasShared && !hasChatIs) return { kind: "ambiguous" };
  if (hasChatIs || hasShared || hasAny(params, COMMON_KEYS)) return { kind: "ambiguous" };
  return { kind: "unrecognized" };
}
