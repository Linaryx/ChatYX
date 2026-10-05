import { expect, test } from "bun:test";

const workspaceCss = (
  await Bun.file(new URL("../src/components/setup/SetupWorkspace.css", import.meta.url)).text()
).replace(/\r\n/g, "\n");
const channelCss = (
  await Bun.file(new URL("../src/components/setup/TwitchChannelField.css", import.meta.url)).text()
).replace(/\r\n/g, "\n");

test("connection platforms each occupy one label-and-channel row", () => {
  const connection = workspaceCss.match(/\.setup-connection \{([^}]+)\}/)?.[1];
  expect(connection).toContain("display: grid;");
  const field = workspaceCss.match(/\.setup-channel-field \{([^}]+)\}/)?.[1];
  expect(field).toContain("display: grid;");
  expect(field).toContain("grid-template-columns: 7rem minmax(0, 1fr);");
  expect(field).toContain("align-items: center;");
  expect(field).not.toContain("max-width: 20rem;");
});

test("channel metrics stay beside the name and scroll instead of wrapping", () => {
  const main = channelCss.match(/\.twitch-channel-main \{([^}]+)\}/)?.[1];
  expect(main).toContain("align-items: center;");
  expect(main).not.toContain("flex-direction: column;");
  const metrics = channelCss.match(/\.twitch-channel-metrics \{([^}]+)\}/)?.[1];
  expect(metrics).toContain("flex-wrap: nowrap;");
  expect(metrics).toContain("overflow-x: auto;");
  const metric = channelCss.match(/\.twitch-channel-metric \{([^}]+)\}/)?.[1];
  expect(metric).toContain("flex: 0 0 auto;");
});

test("Twitch has a visible input label and the metric strip is keyboard reachable", async () => {
  const route = await Bun.file(new URL("../src/routes/setup.tsx", import.meta.url)).text();
  const channel = await Bun.file(
    new URL("../src/components/setup/TwitchChannelField.tsx", import.meta.url),
  ).text();
  expect(route).toContain('for="setup-twitch"');
  expect(route).toContain('inputId="setup-twitch"');
  const connection = route.slice(
    route.indexOf('class="setup-connection"'),
    route.indexOf('class="setup-export"'),
  );
  expect(connection).not.toContain('t("setup.optional")');
  expect(channel).toContain('tabIndex={metrics().length ? 0 : undefined}');
  expect(channel).toContain('aria-label={t("setup.channelMetrics.summary")}');
});
