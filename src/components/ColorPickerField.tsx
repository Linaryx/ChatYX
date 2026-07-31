import type { LucidColorPicker } from "lucid-color-picker";
import "lucid-color-picker";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";

type ColorPickerFieldProps = {
  color: string;
  opacity: number;
  showOpacity?: boolean;
  label?: string;
  onChange: (value: { color: string; opacity: number }) => void;
};

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "lucid-color-picker": {
        ref?: (element: LucidColorPicker) => void;
        value?: string;
      };
    }
  }
}

function normalizeHexColor(raw: string, fallback = "#000000") {
  const value = raw.trim();
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : fallback;
}

function normalizeOpacity(raw: string | number, fallback = 100) {
  const value = typeof raw === "number" ? raw : Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), 100);
}

function splitHexAlpha(raw: string, fallbackColor: string, fallbackOpacity: number) {
  const value = raw.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(value)) {
    return { color: value, opacity: 100 };
  }
  if (/^#[0-9A-F]{8}$/.test(value)) {
    const alpha = Number.parseInt(value.slice(7, 9), 16);
    return {
      color: value.slice(0, 7),
      opacity: Math.round((alpha / 255) * 100),
    };
  }
  return { color: fallbackColor, opacity: fallbackOpacity };
}

function joinHexAlpha(color: string, opacity: number) {
  const safeColor = normalizeHexColor(color);
  const safeOpacity = Math.min(Math.max(opacity, 0), 100);
  const alpha = Math.round((safeOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${safeColor}${alpha}`;
}

function hexToRgba(hex: string, opacity: number) {
  const safeColor = normalizeHexColor(hex);
  const red = Number.parseInt(safeColor.slice(1, 3), 16);
  const green = Number.parseInt(safeColor.slice(3, 5), 16);
  const blue = Number.parseInt(safeColor.slice(5, 7), 16);
  const alpha = Math.min(Math.max(opacity, 0), 100) / 100;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function ColorPickerField(props: ColorPickerFieldProps) {
  const [rootRef, setRootRef] = createSignal<HTMLDivElement>();
  const [panelRef, setPanelRef] = createSignal<HTMLDivElement>();
  const [pickerRef, setPickerRef] = createSignal<LucidColorPicker>();
  const [draft, setDraft] = createSignal(normalizeHexColor(props.color));
  const [draftOpacity, setDraftOpacity] = createSignal(String(props.opacity));
  const [open, setOpen] = createSignal(false);
  const [panelPosition, setPanelPosition] = createSignal({ left: 8, top: 8 });

  const currentValue = () =>
    joinHexAlpha(props.color, props.showOpacity === false ? 100 : props.opacity);

  const styles = {
    root: {
      width: "100%",
      position: "relative",
    },
    control: {
      display: "flex",
      "flex-wrap": "wrap",
      gap: "10px",
      width: "100%",
      "align-items": "center",
    },
    trigger: {
      width: "52px",
      height: "34px",
      padding: "2px",
      border: "1px solid #2a2a2a",
      "border-radius": "10px",
      background: "#111111",
      cursor: "pointer",
      "box-sizing": "border-box",
      flex: "0 0 auto",
    },
    triggerSwatch: {
      width: "100%",
      height: "100%",
      "border-radius": "8px",
      border: "1px solid rgba(255,255,255,0.08)",
      background:
        "linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a), linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a)",
      "background-size": "8px 8px",
      "background-position": "0 0, 4px 4px",
      position: "relative",
      overflow: "hidden",
    },
    swatchOverlay: {
      position: "absolute",
      inset: "0",
    },
    input: {
      padding: "7px 10px",
      height: "34px",
      border: "1px solid #2a2a2a",
      "border-radius": "10px",
      "font-size": "14px",
      background: "#111111",
      color: "#e5e7eb",
      "font-family": "inherit",
      "box-sizing": "border-box",
      width: "160px",
      flex: "1 1 160px",
      "min-width": "0",
      "text-transform": "uppercase",
    },
    opacityInput: {
      padding: "7px 10px",
      height: "34px",
      border: "1px solid #2a2a2a",
      "border-radius": "10px",
      "font-size": "14px",
      background: "#111111",
      color: "#e5e7eb",
      "font-family": "inherit",
      "box-sizing": "border-box",
      width: "72px",
      "text-align": "center",
      flex: "0 0 auto",
    },
    panel: {
      position: "fixed",
      padding: "12px",
      background: "#111111",
      border: "1px solid #2a2a2a",
      "border-radius": "14px",
      "box-shadow": "0 16px 40px rgba(0,0,0,0.45)",
      "z-index": "1000",
    },
  } as const;

  const commitDraft = () => {
    const next = normalizeHexColor(draft(), props.color);
    setDraft(next);
    props.onChange({ color: next, opacity: normalizeOpacity(draftOpacity(), props.opacity) });
  };

  const commitOpacityDraft = () => {
    const next = normalizeOpacity(draftOpacity(), props.opacity);
    setDraftOpacity(String(next));
    props.onChange({ color: normalizeHexColor(draft(), props.color), opacity: next });
  };

  const updatePanelPosition = () => {
    const root = rootRef();
    const panel = panelRef();
    if (!root || !panel || !open()) return;

    const gap = 8;
    const viewportPadding = 8;
    const anchorRect = root.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width || 306;
    const panelHeight = panelRect.height || 306;
    const left = Math.min(
      Math.max(anchorRect.left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding),
    );
    const opensBelow =
      anchorRect.bottom + gap + panelHeight <= window.innerHeight - viewportPadding;
    const top = opensBelow
      ? anchorRect.bottom + gap
      : Math.max(viewportPadding, anchorRect.top - panelHeight - gap);

    setPanelPosition({ left, top });
  };

  onMount(() => {
    const picker = pickerRef();
    if (!picker) return;

    const handleChange = () => {
      const parsed = splitHexAlpha(picker.value, props.color, props.opacity);
      const next =
        props.showOpacity === false
          ? { color: parsed.color, opacity: props.opacity }
          : parsed;
      setDraft(next.color);
      setDraftOpacity(String(next.opacity));
      props.onChange(next);
    };

    const handlePointerDown = (event: MouseEvent) => {
      const root = rootRef();
      const panel = panelRef();
      if (!open() || !root) return;
      const target = event.target;
      if (
        target instanceof Node &&
        !root.contains(target) &&
        !panel?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleViewportChange = () => updatePanelPosition();

    picker.addEventListener("change", handleChange);
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    onCleanup(() => {
      picker.removeEventListener("change", handleChange);
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    });
  });

  createEffect(() => {
    setDraft(normalizeHexColor(props.color));
    setDraftOpacity(String(normalizeOpacity(props.opacity, 100)));
    const picker = pickerRef();
    const value = currentValue();
    if (picker && picker.value !== value) {
      picker.value = value;
    }
  });

  createEffect(() => {
    if (!open()) return;
    window.requestAnimationFrame(updatePanelPosition);
  });

  return (
    <div ref={setRootRef} style={styles.root}>
      <div style={styles.control}>
        <button
          type="button"
          class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={styles.trigger}
          onClick={() => setOpen((value) => !value)}
          aria-label={`${props.label ?? "Цвет"}: открыть палитру`}
          aria-expanded={open()}
          aria-haspopup="dialog"
        >
          <div style={styles.triggerSwatch}>
            <div
              style={{
                ...styles.swatchOverlay,
                background: hexToRgba(
                  props.color,
                  props.showOpacity === false ? 100 : props.opacity,
                ),
              }}
            />
          </div>
        </button>

        <input
          class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value.toUpperCase())}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          placeholder="#000000"
          aria-label={`${props.label ?? "Цвет"}: HEX`}
          style={styles.input}
        />

        <Show when={props.showOpacity !== false}>
          <input
            class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            type="number"
            min="0"
            max="100"
            value={draftOpacity()}
            onInput={(event) => setDraftOpacity(event.currentTarget.value)}
            onBlur={commitOpacityDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitOpacityDraft();
              }
            }}
            placeholder="50"
            aria-label={`${props.label ?? "Цвет"}: прозрачность в процентах`}
            style={styles.opacityInput}
          />
        </Show>
      </div>

      <Portal>
        <div
          ref={setPanelRef}
          role="dialog"
          aria-label={`${props.label ?? "Цвет"}: палитра`}
          style={{
            ...styles.panel,
            display: open() ? "block" : "none",
            left: `${panelPosition().left}px`,
            top: `${panelPosition().top}px`,
          }}
        >
          <lucid-color-picker ref={setPickerRef} value={currentValue()} />
        </div>
      </Portal>
    </div>
  );
}
