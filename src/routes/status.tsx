import { For, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Title } from "@solidjs/meta";
import {
  checkAllDomains,
  createCheckingResult,
  getDomainChecks,
  getRteProxyDomainChecks,
  type DomainCheckResult,
} from "~/services/diagnostics/domainChecks";
import { networkClient } from "~/services/network/networkClient";
import "~/styles/status.css";

const REFRESH_INTERVAL_MS = 15_000;

function formatLatency(durationMs: number | null): string {
  return durationMs === null ? "—" : `${durationMs} ms`;
}

function stateLabel(result: DomainCheckResult): string {
  if (result.state === "checking") return "проверка";
  if (result.error?.startsWith("таймаут")) return "таймаут";
  if (result.state === "error") return "ошибка";
  if (result.state === "slow") return "медленно";
  return "OK";
}

function checkedLabel(checkedAt: number | null): string {
  if (!checkedAt) return "Проверка еще не запускалась";
  return `Обновлено в ${new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(checkedAt)}`;
}

type StatusOverlayProps = {
  viaRte?: boolean;
};

export function StatusOverlay(props: StatusOverlayProps = {}) {
  const viaRte = props.viaRte ?? false;
  const checks = viaRte ? getRteProxyDomainChecks() : getDomainChecks();
  const [results, setResults] = createSignal(
    checks.map(createCheckingResult),
  );
  const [isChecking, setIsChecking] = createSignal(false);
  const [checkedAt, setCheckedAt] = createSignal<number | null>(null);
  const healthyCount = createMemo(
    () => results().filter((result) => result.state === "ok" || result.state === "slow").length,
  );
  let stopped = false;
  let refreshTimer: number | undefined;

  const runChecks = async () => {
    if (stopped || isChecking()) return;
    setIsChecking(true);

    try {
      const nextResults = await checkAllDomains(
        checks,
        viaRte
          ? (input, init) => networkClient.request(String(input), { route: "rte-required", init })
          : undefined,
      );
      if (stopped) return;
      setResults(nextResults);
      setCheckedAt(Date.now());
    } finally {
      if (!stopped) setIsChecking(false);
    }
  };

  onMount(() => {
    void runChecks();
    refreshTimer = window.setInterval(() => void runChecks(), REFRESH_INTERVAL_MS);
  });

  onCleanup(() => {
    stopped = true;
    if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
  });

  return (
    <>
      <Title>ChatYX Status</Title>
      <main class="status-page" aria-labelledby="status-title">
        <section class="status-card">
          <header class="status-header">
            <div>
              <p class="status-kicker">ChatYX / {viaRte ? "RTE proxy" : "network"}</p>
              <h1 id="status-title">{viaRte ? "RTE proxy" : "Домены"}</h1>
            </div>
            <p class="status-summary">{healthyCount()}/{checks.length} online</p>
          </header>

          <div class="status-live" role="status" aria-live="polite">
            {isChecking() ? "Проверяем доступность доменов..." : checkedLabel(checkedAt())}
          </div>

          <ul class="status-list">
            <For each={results()}>
              {(result) => {
                const host = new URL(result.definition.url).host;
                return (
                  <li class={`status-row status-row--${result.state}`}>
                    <span class="status-indicator" aria-hidden="true" />
                    <span class="status-service">
                      <strong>{result.definition.label}</strong>
                      <span>{host}</span>
                    </span>
                    <span class="status-state">{stateLabel(result)}</span>
                    <span
                      class="status-latency"
                      title={result.error || undefined}
                    >
                      {formatLatency(result.durationMs)}
                    </span>
                  </li>
                );
              }}
            </For>
          </ul>

          <footer class="status-footer">{checkedLabel(checkedAt())} · авто 15 с</footer>
        </section>
      </main>
    </>
  );
}

export default function StatusRoute() {
  return <StatusOverlay />;
}
