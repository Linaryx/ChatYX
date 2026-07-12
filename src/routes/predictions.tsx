import { Title } from "@solidjs/meta";
import { Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { PredictionProgressOverlay } from "~/components/predictions/PredictionProgressOverlay";
import {
  createTwitchPredictionsClient,
  type TwitchPredictionEvent,
  type TwitchPredictionsConnectionState,
} from "~/services/predictions/twitchPredictions";

function normalizeChannel(value: string | null): string {
  return (value || "").trim().replace(/^#|^@/, "").toLowerCase();
}

export default function PredictionsOverlay() {
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const channel = normalizeChannel(params.get("c") || params.get("channel"));
  const isDebug = params.get("debug") === "true";

  const [prediction, setPrediction] = createSignal<TwitchPredictionEvent | null>(
    null,
  );
  const [state, setState] =
    createSignal<TwitchPredictionsConnectionState>("idle");
  const [error, setError] = createSignal("");
  const [now, setNow] = createSignal(Date.now());

  const pageTitle = createMemo(() =>
    channel ? `ChatYX Predictions • ${channel}` : "ChatYX Predictions",
  );

  onMount(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    let client:
      | ReturnType<typeof createTwitchPredictionsClient>
      | undefined;

    if (channel) {
      client = createTwitchPredictionsClient({
        channelLogin: channel,
        onPrediction: setPrediction,
        onStateChange: setState,
        onError: (nextError) => setError(nextError.message),
      });
      client.start();
    }

    onCleanup(() => {
      window.clearInterval(tick);
      client?.stop();
    });
  });

  return (
    <>
      <Title>{pageTitle()}</Title>
      <style>
        {`
          html,
          body,
          #root {
            width: 100%;
            height: 100%;
            margin: 0;
            overflow: hidden;
            background: transparent;
          }

          .predictions-page {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 28px;
            box-sizing: border-box;
            pointer-events: none;
          }

          .predictions-debug {
            position: fixed;
            top: 12px;
            left: 12px;
            max-width: min(520px, calc(100vw - 24px));
            padding: 10px 12px;
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.72);
            color: #fff;
            font: 12px/1.35 Consolas, monospace;
            pointer-events: auto;
            white-space: pre-wrap;
          }

          .predictions-error {
            color: #ff8f8f;
          }
        `}
      </style>
      <Show
        when={channel}
        fallback={
          <div class="predictions-debug predictions-error">
            Error: channel query parameter is required.
          </div>
        }
      >
        <main class="predictions-page">
          <PredictionProgressOverlay event={prediction()} now={now()} />
        </main>
        <Show when={isDebug}>
          <div class="predictions-debug">
            {JSON.stringify(
              {
                channel,
                state: state(),
                error: error() || null,
                prediction: prediction()
                  ? {
                      id: prediction()?.id,
                      title: prediction()?.title,
                      status: prediction()?.status,
                      source: prediction()?.source,
                      outcomes: prediction()?.outcomes.map((outcome) => ({
                        title: outcome.title,
                        points: outcome.totalPoints,
                        users: outcome.totalUsers,
                      })),
                    }
                  : null,
              },
              null,
              2,
            )}
          </div>
        </Show>
      </Show>
    </>
  );
}

