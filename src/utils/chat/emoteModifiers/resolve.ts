import type {
  EmoteModifierEffect,
  EmoteModifierToken,
  ModifierPosition,
  ResolvedEmoteModifier,
} from "./types";

const PREFIX_MODIFIERS: Record<string, EmoteModifierEffect> = {
  "w!": "wide",
  "h!": "flip-x",
  "v!": "flip-y",
  "z!": "zero-space",
  "c!": "cursed",
  "l!": "rotate-left",
  "r!": "rotate-right",
  "p!": "party",
  "s!": "shake",
};

const SUFFIX_MODIFIERS: Record<string, EmoteModifierEffect> = {
  ffzW: "wide",
  ffzX: "flip-x",
  ffzY: "flip-y",
  ffzCursed: "cursed",
};

export function getEmoteModifier(
  token: string,
): EmoteModifierToken["modifier"] | undefined {
  const prefixEffect = PREFIX_MODIFIERS[token];
  if (prefixEffect) return { position: "prefix", effect: prefixEffect };

  const suffixEffect = SUFFIX_MODIFIERS[token];
  if (suffixEffect) return { position: "suffix", effect: suffixEffect };

  return undefined;
}

function collectModifiers(
  tokens: EmoteModifierToken[],
  targetIndex: number,
  position: ModifierPosition,
): number[] {
  const collected: number[] = [];
  const step = position === "prefix" ? -1 : 1;
  let index = targetIndex + step;
  let foundModifier = false;

  while (index >= 0 && index < tokens.length) {
    const token = tokens[index];
    if (token.isWhitespace) {
      collected.push(index);
      index += step;
      continue;
    }

    if (token.modifier?.position !== position) break;
    foundModifier = true;
    collected.push(index);
    index += step;
  }

  return foundModifier ? collected : [];
}

function trimOuterWhitespace(
  tokens: EmoteModifierToken[],
  indexes: number[],
  position: ModifierPosition,
): number[] {
  const modifiers = indexes.filter((index) => !tokens[index].isWhitespace);
  if (modifiers.length === 0) return [];

  const boundary =
    position === "prefix" ? Math.min(...modifiers) : Math.max(...modifiers);

  return indexes.filter(
    (index) =>
      !tokens[index].isWhitespace ||
      (position === "prefix" ? index > boundary : index < boundary),
  );
}

export function resolveEmoteModifiers(
  tokens: EmoteModifierToken[],
): ResolvedEmoteModifier[] {
  const resolved: ResolvedEmoteModifier[] = tokens.map(() => ({
    effects: [] as EmoteModifierEffect[],
    consumed: false,
  }));

  for (let targetIndex = 0; targetIndex < tokens.length; targetIndex += 1) {
    if (!tokens[targetIndex].isTarget) continue;

    const prefix = collectModifiers(tokens, targetIndex, "prefix");
    const suffix = collectModifiers(tokens, targetIndex, "suffix");
    const consumedIndexes = new Set([
      ...trimOuterWhitespace(tokens, prefix, "prefix"),
      ...trimOuterWhitespace(tokens, suffix, "suffix"),
    ]);
    const modifierIndexes = Array.from(consumedIndexes)
      .filter((index) => !tokens[index].isWhitespace)
      .sort((left, right) => left - right);
    if (modifierIndexes.length === 0) continue;

    const resolvedEffects = Array.from(
      new Set(modifierIndexes.map((index) => tokens[index].modifier!.effect)),
    );
    // z! only removes spacing before the target — no visual effect.
    const effects = resolvedEffects.filter((effect) => effect !== "zero-space");
    const prefixModifierIndexes = modifierIndexes.filter(
      (index) => tokens[index].modifier?.position === "prefix",
    );
    const leadingWhitespaceIndex = resolvedEffects.includes("zero-space")
      ? Math.min(...prefixModifierIndexes) - 1
      : -1;

    resolved[targetIndex] = {
      effects,
      consumed: false,
      accessibleText: Array.from(consumedIndexes)
        .sort((left, right) => left - right)
        .concat(targetIndex)
        .sort((left, right) => left - right)
        .map((index) => tokens[index].raw)
        .join(""),
    };

    for (const index of consumedIndexes) {
      if (index !== targetIndex) resolved[index].consumed = true;
    }
    if (tokens[leadingWhitespaceIndex]?.isWhitespace) {
      resolved[leadingWhitespaceIndex].consumed = true;
    }
  }

  return resolved;
}
