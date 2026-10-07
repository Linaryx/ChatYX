import type { MessageRemovalMode } from "~/config/chatAnimation";
import type Disintegrator from "vanilla-disintegrate/snapdom";
import type { SnapdomCaptureOptions } from "vanilla-disintegrate/snapdom";

export const REMOVAL_CAPTURE_OPTIONS: SnapdomCaptureOptions = {
  dpr: 2,
  // Paints may carry their own shadows; capture those as well as the row's.
  outerShadows: "subtree",
  embedFonts: true,
  // Provider styles can change without changing the message's DOM identity.
  invalidate: true,
  plugins: [{
    name: "chatyx:freeze-removal-snapshot",
    beforeRender: ({ clone }) => {
      if (!clone) return;
      // Computed styles already contain the current paint/modifier frame. Do not
      // restart CSS animations on the cloned nickname or animated emote layers.
      for (const node of [clone, ...clone.querySelectorAll<HTMLElement | SVGElement>("*")]) {
        node.style.setProperty("animation", "none", "important");
        node.style.setProperty("transition", "none", "important");
      }
    },
  }],
};

/** Ancestor filters affect the live row but are outside its captured subtree. */
export function getInheritedRemovalFilter(element: HTMLElement): string {
  const filters: string[] = [];
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const filter = getComputedStyle(ancestor).filter;
    if (filter && filter !== "none") filters.push(filter);
  }
  return filters.join(" ");
}

/** Presentation-owned removal effects; the caller remains the owner of DOM/state. */
export class MessageRemovalManager {
  private readonly pending = new Map<HTMLElement, { cancel?: () => void; restore?: () => void; finished?: Promise<void> }>();
  private readonly groups = new Map<HTMLElement, readonly HTMLElement[]>();
  private disintegrator: Disintegrator | null = null;
  private loading: Promise<Disintegrator | null> | null = null;
  private destroyed = false;

  isRemoving(element: HTMLElement): boolean {
    return this.pending.has(element);
  }

  removeGroup(container: HTMLElement, elements: readonly HTMLElement[], mode: MessageRemovalMode, onRemove: () => void): void {
    if (this.destroyed) return;
    if (elements.every((element) => !element.isConnected)) {
      onRemove();
      return;
    }
    const active = this.pending.get(container);
    if (active) {
      // Keep overlapping moderation batches animated instead of committing the
      // second batch immediately while the shared container is being captured.
      void active.finished?.then(() => this.removeGroup(container, elements, mode, onRemove));
      return;
    }
    this.remove(container, mode, onRemove, elements);
  }

  remove(element: HTMLElement, mode: MessageRemovalMode, onRemove: () => void, group?: readonly HTMLElement[]): void {
    if (this.destroyed || this.pending.has(element)) return;
    if (mode === "none" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onRemove();
      return;
    }

    const entry: { cancel?: () => void; restore?: () => void; finished?: Promise<void> } = {};
    this.pending.set(element, entry);
    if (group) this.groups.set(element, group);
    const targets = group ?? [element];
    let committed = false;
    const commit = () => {
      if (committed || this.destroyed) return;
      committed = true;
      onRemove();
    };
    const animate = async () => {
      try {
        if (mode === "thanos") {
          const effect = await this.getDisintegrator();
          if (this.destroyed) return;
          if (effect && element.isConnected) {
            const inheritedFilter = getInheritedRemovalFilter(element);
            // Capture first, then conceal the live content while retaining its space.
            // Commit Solid's removal only after the particle overlay finishes.
            const operation = effect.remove(element, {
              detach: () => {
                const originals = targets.map((target) => ({
                  target,
                  opacity: target.style.getPropertyValue("opacity"),
                  priority: target.style.getPropertyPriority("opacity"),
                }));
                entry.restore = () => {
                  for (const { target, opacity, priority } of originals) {
                    if (opacity) target.style.setProperty("opacity", opacity, priority);
                    else target.style.removeProperty("opacity");
                  }
                };
                for (const target of targets) target.style.setProperty("opacity", "0", "important");
              },
              layout: false,
              onStart: ({ overlay }) => {
                // The particle layer lives under body, outside the chat's drop-shadow.
                if (overlay && inheritedFilter) overlay.style.filter = inheritedFilter;
              },
            });
            entry.cancel = () => operation.cancel();
            await operation.finished;
            commit();
            return;
          }
        }
        if (this.destroyed) return;
        const visible = targets.filter((target) => target.isConnected && typeof target.animate === "function");
        if (visible.length === 0) {
          commit();
          return;
        }
        const animations = visible.map((target) => target.animate(
          [{ opacity: getComputedStyle(target).opacity }, { opacity: 0 }],
          { duration: 500, easing: "ease-out", fill: "forwards" },
        ));
        entry.cancel = () => animations.forEach((animation) => animation.cancel());
        try {
          await Promise.all(animations.map((animation) => animation.finished));
          commit();
        } finally {
          entry.cancel();
        }
      } catch {
        // Capture/CORS or renderer failure must never prevent moderation removal.
        commit();
      } finally {
        entry.restore?.();
        this.pending.delete(element);
        this.groups.delete(element);
      }
    };
    entry.finished = animate();
  }

  private getDisintegrator(): Promise<Disintegrator | null> {
    if (this.loading) return this.loading;
    this.loading = import("vanilla-disintegrate/snapdom").then((module) => {
      if (this.destroyed) return null;
      const capture = module.createSnapdomCapture(REMOVAL_CAPTURE_OPTIONS);
      this.disintegrator = new module.default({
        preparation: false,
        capture: (element, context) => {
          const group = this.groups.get(element);
          if (!group) return capture(element, context);
          const selected = new Set(group);
          return module.createSnapdomCapture({
            ...REMOVAL_CAPTURE_OPTIONS,
            plugins: [...(REMOVAL_CAPTURE_OPTIONS.plugins ?? []), {
              name: "chatyx:selected-removal-rows",
              beforeRender: ({ nodeMap }) => {
                if (!(nodeMap instanceof Map)) return;
                for (const [clone, source] of nodeMap as Map<Element, Element>) {
                  // Hide other users only in the snapshot, keeping their slots so
                  // selected particles retain the original positions in the feed.
                  if (source instanceof HTMLElement && source.classList.contains("chat_line") && !selected.has(source)) {
                    (clone as HTMLElement).style.setProperty("opacity", "0", "important");
                  }
                }
              },
            }],
          })(element, context);
        },
        effect: module.createParticleEffect({
          remove: {
            particleSize: 0.5,
            alphaThreshold: 0,
            curve: "settle",
            release: "left",
            releaseRandomness: 0.66,
            duration: 1300,
            stagger: 450,
            fadeStart: 0.2,
            layoutRelease: 0.6,
            horizontalDrift: 70,
            horizontalTravel: [0, 300],
            verticalTravel: [0, 0],
            convergence: 0,
            swirl: 34,
            waveTurns: 1,
            endScale: 0.55,
            rotation: [0, 0],
          },
          restore: module.particlePresets.dust,
        }),
        sound: false,
      });
      return this.disintegrator;
    });
    return this.loading;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const entry of this.pending.values()) {
      entry.cancel?.();
      entry.restore?.();
    }
    this.pending.clear();
    this.groups.clear();
    this.disintegrator?.destroy();
    this.disintegrator = null;
    this.loading = null;
  }
}
