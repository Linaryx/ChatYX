import { describe, expect, test } from "bun:test";
import { ChatPresentationService } from "../src/services/chat/chatPresentationService";

function createService(singleChatter: string) {
  return new ChatPresentationService({
    botFilter: {
      enabled: false,
      hideCommands: false,
      customBots: [],
      singleChatter,
    },
  });
}

describe("ChatPresentationService chatter filter", () => {
  test("uses normalized configured chatter names", () => {
    const service = createService("Alpha, Beta gamma");

    expect(service.shouldDisplayMessage("ALPHA", "hello")).toBe(true);
    expect(service.shouldDisplayMessage("beta", "hello")).toBe(true);
    expect(service.shouldDisplayMessage("Gamma", "hello")).toBe(true);
    expect(service.shouldDisplayMessage("other", "hello")).toBe(false);
  });

  test("rebuilds the chatter set when configuration changes", () => {
    const service = createService("alpha");

    service.updateConfig({
      botFilter: {
        enabled: false,
        hideCommands: false,
        customBots: [],
        singleChatter: "beta",
      },
    });

    expect(service.shouldDisplayMessage("alpha", "hello")).toBe(false);
    expect(service.shouldDisplayMessage("BETA", "hello")).toBe(true);
  });
});

describe("ChatPresentationService bot filter", () => {
  test("hides listed bots when filter is enabled", () => {
    const service = new ChatPresentationService({
      botFilter: {
        enabled: true,
        hideCommands: true,
        customBots: ["mybot"],
        singleChatter: "",
      },
    });

    expect(service.shouldDisplayMessage("MyBot", "announcement text")).toBe(false);
    expect(service.shouldDisplayMessage("regularviewer", "hello")).toBe(true);
  });

  test("shows listed bots when filter is disabled", () => {
    const service = new ChatPresentationService({
      botFilter: {
        enabled: false,
        hideCommands: false,
        customBots: ["mybot"],
        singleChatter: "",
      },
    });

    expect(service.shouldDisplayMessage("MyBot", "announcement text")).toBe(true);
  });
});
