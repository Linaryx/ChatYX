import { describe, expect, test } from "bun:test";
import {
  getAuthorizedChatCommand,
  isDeveloperChatMessage,
  parseChatCommand,
  parseTestMessageCount,
  resolveChatCommandRole,
} from "../src/services/chat/chatCommandService";
import {
  TwitchService,
  type TwitchMessage,
} from "../src/services/chat/twitchService";

function message(
  text: string,
  badges: string[] = [],
  isModerator = false,
  overrides: Partial<TwitchMessage> = {},
): TwitchMessage {
  return {
    id: "1",
    username: "tester",
    displayName: "Tester",
    message: text,
    color: "#fff",
    badges,
    emotes: {},
    userType: "",
    isModerator,
    isSubscriber: false,
    timestamp: new Date(0),
    ...overrides,
  };
}

describe("chat commands", () => {
  test("parses ChatIS, Cyan Chat, and jChat aliases", () => {
    expect(parseChatCommand("!chat refresh")).toEqual({ name: "refresh", args: "", targetChannels: [] });
    expect(parseChatCommand("!chatis reload")).toEqual({ name: "reload", args: "", targetChannels: [] });
    expect(parseChatCommand("!chatyx clear")).toEqual({ name: "clear", args: "", targetChannels: [] });
    expect(parseChatCommand("!refreshoverlay")).toEqual({ name: "refresh", args: "", targetChannels: [] });
    expect(parseChatCommand("!reloadchat")).toEqual({ name: "reload", args: "", targetChannels: [] });
  });

  test("does not expose media or speech commands", () => {
    expect(parseChatCommand("!chat img Kappa")).toBeNull();
    expect(parseChatCommand("!chat tts hello")).toBeNull();
    expect(parseChatCommand("!chat rickroll")).toBeNull();
    expect(parseChatCommand("!chat ytplay https://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(parseChatCommand("!chat ytstop")).toBeNull();
  });

  test("supports broadcaster, lead moderator, and moderator roles", () => {
    expect(resolveChatCommandRole(message("", ["broadcaster/1"]))).toBe("broadcaster");
    expect(resolveChatCommandRole(message("", ["lead_moderator/1"]))).toBe("lead_moderator");
    expect(resolveChatCommandRole(message("", ["moderator/1"]))).toBe("moderator");
    expect(resolveChatCommandRole(message("", [], true))).toBe("moderator");
  });

  test("rejects commands from viewers", () => {
    expect(getAuthorizedChatCommand(message("!chat reload"), "target")).toBeNull();
    expect(
      getAuthorizedChatCommand(message("!chat reload", ["lead_moderator/1"]), "target"),
    ).toEqual({ name: "reload", args: "", targetChannels: [] });
  });

  test("accepts targeted developer commands only from the verified account", () => {
    const developer = message("!chatyx refresh -c target", [], false, {
      username: "linaryx",
      userId: "684505240",
      sourceChannel: "linaryx",
    });
    expect(getAuthorizedChatCommand(developer, "target")).toEqual({
      name: "refresh",
      args: "",
      targetChannels: ["target"],
    });
    expect(getAuthorizedChatCommand(developer, "another")).toBeNull();
    expect(
      getAuthorizedChatCommand({ ...developer, userId: "1" }, "target"),
    ).toBeNull();
    expect(
      getAuthorizedChatCommand({ ...developer, message: "!chatyx refresh" }, "target"),
    ).toBeNull();
    expect(isDeveloperChatMessage(developer, "target")).toBeTrue();
    expect(isDeveloperChatMessage(developer, "linaryx")).toBeFalse();
  });

  test("preserves IRC source channel and user ID for developer verification", () => {
    const parsed = new TwitchService().parseMessageLine(
      "@badges=broadcaster/1;display-name=Linaryx;id=msg-1;mod=0;subscriber=0;user-id=684505240 :linaryx!linaryx@linaryx.tmi.twitch.tv PRIVMSG #linaryx :!chatyx ping -c target",
    );
    expect(parsed?.sourceChannel).toBe("linaryx");
    expect(parsed?.username).toBe("linaryx");
    expect(parsed?.userId).toBe("684505240");
  });

  test("caps generated test messages", () => {
    expect(parseTestMessageCount("")).toBe(5);
    expect(parseTestMessageCount("12")).toBe(12);
    expect(parseTestMessageCount("500")).toBe(50);
  });

});
