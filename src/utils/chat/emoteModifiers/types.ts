export type EmoteModifierEffect =
  | "wide"
  | "flip-x"
  | "flip-y"
  | "zero-space"
  | "cursed"
  | "rotate-left"
  | "rotate-right"
  | "party"
  | "shake";

export type ModifierPosition = "prefix" | "suffix";

export type EmoteModifierToken = {
  raw: string;
  isWhitespace: boolean;
  isTarget: boolean;
  modifier?: {
    position: ModifierPosition;
    effect: EmoteModifierEffect;
  };
};

export type ResolvedEmoteModifier = {
  effects: EmoteModifierEffect[];
  consumed: boolean;
  accessibleText?: string;
};

export type EmoteSizeBox = {
  width: number;
  height: number;
};

export type WideLayout = {
  width: number;
  height: number;
  rotated: boolean;
};
