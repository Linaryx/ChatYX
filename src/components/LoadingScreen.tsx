import { Show, createEffect, createSignal, onCleanup } from "solid-js";

interface LoadingScreenProps {
  progress: number;
  status: string;
  onComplete?: () => void;
  overlay?: boolean;
  background?: string;
}

const loadingImageSrc = "https://cdn.7tv.app/emote/01G9TPJZE0000AGTWTH4BHTCRD/4x.webp";

export function LoadingScreen(props: LoadingScreenProps) {
  const [showFinalScreen, setShowFinalScreen] = createSignal(false);
  let completeTimer: number | undefined;

  createEffect(() => {
    if (props.overlay || props.progress < 100 || showFinalScreen()) return;

    setShowFinalScreen(true);
    completeTimer = window.setTimeout(() => {
      props.onComplete?.();
    }, 3000);
  });

  onCleanup(() => {
    if (completeTimer !== undefined) {
      window.clearTimeout(completeTimer);
    }
  });

  return (
    <>
      <Show when={props.overlay}>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-busy="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: props.background ?? "rgba(0, 0, 0, 0.5)",
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            "z-index": "99999",
            "pointer-events": "none",
          }}
        >
          <img
            src={loadingImageSrc}
            alt=""
            style={{
              width: "64px",
              height: "64px",
              "margin-bottom": "10px",
            }}
          />
          <div
            style={{
              "font-family": "Inter, system-ui, -apple-system, sans-serif",
              "font-size": "14px",
              color: "rgb(255, 255, 255)",
              "font-weight": "600",
              "letter-spacing": "0.3px",
              "text-align": "center",
              padding: "0 12px",
            }}
          >
            {props.status}
          </div>
        </div>
      </Show>

      {/* Сцена 1: Крутящийся эмоут со статусом (с фоном) */}
      <Show when={!props.overlay && !showFinalScreen()}>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-busy="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: props.background ?? "rgba(0, 0, 0, 0.5)",
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            "z-index": "99999",
          }}
        >
          <img
            src={loadingImageSrc}
            alt="Loading..."
            style={{
              width: "128px",
              height: "128px",
              "margin-bottom": "20px",
            }}
          />
          <div
            style={{
              "font-family": "Inter, system-ui, -apple-system, sans-serif",
              "font-size": "16px",
              color: "rgb(255, 255, 255)",
              "font-weight": "600",
              "letter-spacing": "0.3px",
            }}
          >
            {props.status}
          </div>
        </div>
      </Show>

      {/* Сцена 2: Финальная надпись (без фона) */}
      <Show when={!props.overlay && showFinalScreen()}>
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: 0,
            width: "100vw",
            display: "flex",
            "justify-content": "center",
            "z-index": "9000",
            "pointer-events": "none",
          }}
        >
          <div
            style={{
              "font-family": "Inter, system-ui, -apple-system, sans-serif",
              "font-size": "16px",
              color: "rgba(255, 255, 255, 0.95)",
              "font-weight": "700",
              "letter-spacing": "2px",
              "text-shadow": "0 0 20px rgba(0, 0, 0, 0.8)",
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            ChatYX
          </div>
        </div>
      </Show>

      {/* CSS анимации */}
      <style>
        {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;900&display=swap');
                    @keyframes fadeIn {
                        from { opacity: 0; transform: scale(0.9); }
                        to { opacity: 1; transform: scale(1); }
                    }
                `}
      </style>
    </>
  );
}
