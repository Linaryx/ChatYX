import { describe, expect, test } from "bun:test";
import { TwitchService } from "../src/services/chat/twitchService";

const service = new TwitchService();

describe("Twitch IRC event classification", () => {
  test("classifies first messages", () => {
    const message = service.parseMessageLine(
      "@badges=;color=#00ff00;display-name=NewViewer;first-msg=1;id=first-1;mod=0;subscriber=0;user-id=1 :newviewer!newviewer@newviewer.tmi.twitch.tv PRIVMSG #channel :hello",
    );

    expect(message?.twitchEvent).toEqual({
      type: "first-message",
      label: "Впервые в чате",
    });
  });

  test("classifies channel point rewards", () => {
    const message = service.parseMessageLine(
      "@badges=;color=#ff0000;custom-reward-id=reward-1;display-name=Viewer;id=reward-msg;mod=0;subscriber=0;user-id=2 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #channel :reward text",
    );

    expect(message?.twitchEvent?.type).toBe("reward");
    expect(message?.customRewardId).toBe("reward-1");
  });

  test("does not highlight broadcaster messages", () => {
    const message = service.parseMessageLine(
      "@badges=broadcaster/1;color=#ff0000;display-name=Streamer;id=broadcaster-1;mod=0;subscriber=0;user-id=10 :streamer!streamer@streamer.tmi.twitch.tv PRIVMSG #channel :important message",
    );

    expect(message?.twitchEvent).toBeUndefined();
  });

  test("classifies highlighted channel point messages", () => {
    const message = service.parseMessageLine(
      "@badges=;color=#0000ff;display-name=Supporter;id=highlight-1;mod=0;msg-id=highlighted-message;subscriber=0;user-id=3 :supporter!supporter@supporter.tmi.twitch.tv PRIVMSG #channel :notice me",
    );

    expect(message?.twitchEvent).toEqual({
      type: "highlighted-message",
      label: "Выделенное сообщение",
    });
  });

  test("classifies gigantified emote power-ups", () => {
    const message = service.parseMessageLine(
      "@badges=;bits=100;color=#0000ff;display-name=Supporter;id=power-up-1;mod=0;msg-id=gigantified-emote-message;subscriber=0;user-id=3 :supporter!supporter@supporter.tmi.twitch.tv PRIVMSG #channel :Kappa",
    );

    expect(message?.twitchEvent).toEqual({
      type: "power-up",
      label: "Гигантский эмоут",
      count: 100,
    });
    expect(message?.isGigantifiedEmote).toBe(true);
  });

  test("keeps gigantified emotes classified as power-ups when a reward id is present", () => {
    const message = service.parseMessageLine(
      "@badges=;bits=777;color=#0000ff;custom-reward-id=reward-1;display-name=Supporter;id=power-up-reward-1;mod=0;msg-id=gigantified-emote-message;subscriber=0;user-id=3 :supporter!supporter@supporter.tmi.twitch.tv PRIVMSG #channel :Kappa",
    );

    expect(message?.twitchEvent).toEqual({
      type: "power-up",
      label: "Гигантский эмоут",
      count: 777,
    });
    expect(message?.isGigantifiedEmote).toBe(true);
  });

  test("classifies raids from USERNOTICE", () => {
    const message = service.parseMessageLine(
      "@badges=;color=#9146ff;display-name=Raider;id=raid-1;login=raider;mod=0;msg-id=raid;msg-param-displayName=Raider;msg-param-viewerCount=42;subscriber=0;system-msg=Raider\\sis\\sraiding;user-id=4 :tmi.twitch.tv USERNOTICE #channel",
    );

    expect(message?.username).toBe("raider");
    expect(message?.twitchEvent).toEqual({
      type: "raid",
      label: "Рейд",
      detail: "Raider",
      count: 42,
    });
  });

  test("classifies subscriptions from USERNOTICE", () => {
    const message = service.parseMessageLine(
      "@badges=subscriber/1;color=#9146ff;display-name=Subber;id=sub-1;login=subber;mod=0;msg-id=resub;subscriber=1;system-msg=Subber\\ssubscribed\\sfor\\s3\\smonths!;user-id=5 :tmi.twitch.tv USERNOTICE #channel :three months",
    );

    expect(message?.twitchEvent).toEqual({
      type: "subscription",
      label: "Продление подписки",
      detail: "Subber продлил(а) подписку",
    });
  });

  test("uses the color selected for announcements", () => {
    const message = service.parseMessageLine(
      "@badges=broadcaster/1;color=#9146ff;display-name=Streamer;id=announcement-1;login=streamer;mod=0;msg-id=announcement;msg-param-color=GREEN;subscriber=0;user-id=10 :tmi.twitch.tv USERNOTICE #channel :important update",
    );

    expect(message?.twitchEvent).toEqual({
      type: "announcement",
      label: "Объявление",
      level: "GREEN",
      color: "#00c800",
    });
  });
});
