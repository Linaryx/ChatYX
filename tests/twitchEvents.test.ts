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

  test("classifies watch streaks and keeps the viewer message", () => {
    const message = service.parseMessageLine(
      "@badge-info=subscriber/3;badges=subscriber/3;color=#9146ff;display-name=GregdH_;id=streak-1;login=gregdh_;mod=0;msg-id=viewermilestone;msg-param-category=watch-streak;msg-param-copoReward=350;msg-param-id=milestone-1;msg-param-value=3;subscriber=1;system-msg=GregdH_\\swatched\\s3\\sconsecutive\\sstreams\\sthis\\smonth\\sand\\ssparked\\sa\\swatch\\sstreak!;user-id=6 :tmi.twitch.tv USERNOTICE #channel :Серия продолжается",
    );

    expect(message?.twitchEvent).toEqual({
      type: "watch-streak",
      label: "Новая серия просмотров!",
      detail: "GregdH_",
      count: 3,
      points: 350,
    });
    expect(message?.message).toBe("Серия продолжается");
  });

  test("parses historical watch streak notices without a message colon", () => {
    const message = service.parseMessageLine(
      "@subscriber=0;historical=1;mod=0;emotes;badges=vip/1,qsmp2/1;flags;room-id=684505240;rm-received-ts=1784907129972;user-id=713840442;msg-param-id=1acb20d4-dd6e-4bf8-8d75-66c7dd76bc0e;tmi-sent-ts=1784907129877;vip=1;system-msg=x1m000\\swatched\\s15\\sconsecutive\\sstreams\\sand\\ssparked\\sa\\swatch\\sstreak!;color=#0000FF;msg-param-category=watch-streak;login=x1m000;id=08d3f8ae-a4ff-428a-b454-a5dbeec4746c;msg-param-value=15;display-name=x1m000;user-type;msg-param-copoReward=450;badge-info;msg-id=viewermilestone :tmi.twitch.tv USERNOTICE #linaryx Ezhik",
    );

    expect(message?.message).toBe("Ezhik");
    expect(message?.twitchEvent).toEqual({
      type: "watch-streak",
      label: "Новая серия просмотров!",
      detail: "x1m000",
      count: 15,
      points: 450,
    });
  });

  test("parses other historical USERNOTICE messages without a message colon", () => {
    const message = service.parseMessageLine(
      "@historical=1;badges=subscriber/1;color=#9146ff;display-name=Subber;id=historical-sub;login=subber;mod=0;msg-id=sub;subscriber=1;user-id=5 :tmi.twitch.tv USERNOTICE #channel Спасибо!",
    );

    expect(message?.message).toBe("Спасибо!");
    expect(message?.twitchEvent).toEqual({
      type: "subscription",
      label: "Новая подписка",
      detail: "Subber оформил(а) подписку",
    });
  });

  test("handles the watch streak alias and malformed counters", () => {
    const message = service.parseMessageLine(
      "@badges=;color=#9146ff;display-name=Viewer;id=streak-2;login=viewer;mod=0;msg-id=viewermilestone;msg-param-category=watch-fk;msg-param-copoReward=350oops;msg-param-value=three;subscriber=0;user-id=7 :tmi.twitch.tv USERNOTICE #channel",
    );

    expect(message?.twitchEvent).toEqual({
      type: "watch-streak",
      label: "Новая серия просмотров!",
      detail: "Viewer",
      count: undefined,
      points: undefined,
    });
  });

  test("ignores unrelated viewer milestones", () => {
    const message = service.parseMessageLine(
      "@badges=;color=#9146ff;display-name=Viewer;id=milestone-1;login=viewer;mod=0;msg-id=viewermilestone;msg-param-category=unknown;msg-param-value=3;subscriber=0;user-id=7 :tmi.twitch.tv USERNOTICE #channel",
    );

    expect(message?.twitchEvent).toBeUndefined();
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

  test("extracts the sender username from tags for USERNOTICE", () => {
    const message = service.parseMessageLine(
      "@tmi-sent-ts=1788427906550;mod=1;id=8e7f6cd8-7e35-4d71-9254-0dd169ea9605;room-id=170934291;user-id=870280719;login=twirapp;display-name=TwirApp;badges=moderator/1;badge-info=;color=#8A2BE2;flags=;user-type=mod;emotes=;msg-param-color=PRIMARY;system-msg=;msg-id=announcement :tmi.twitch.tv USERNOTICE #jacklooney :Нарезчик? Хочешь заработать денег!",
    );

    expect(message?.username).toBe("twirapp");
    expect(message?.displayName).toBe("TwirApp");
    expect(message?.twitchEvent?.type).toBe("announcement");
  });

  test("parses Shared Chat metadata from PRIVMSG", () => {
    const message = service.parseMessageLine(
      "@badges=moderator/1;color=#00ff00;display-name=SharedViewer;id=delivered-1;mod=1;room-id=100;source-badges=subscriber/12;source-id=original-1;source-room-id=200;subscriber=0;user-id=7 :sharedviewer!sharedviewer@sharedviewer.tmi.twitch.tv PRIVMSG #target :hello from shared chat",
    );

    expect(message).toMatchObject({
      id: "delivered-1",
      sourceMessageId: "original-1",
      sourceChannelId: "200",
      targetChannelId: "100",
      sourceChannel: "target",
      badges: ["subscriber/12"],
      targetBadges: ["moderator/1"],
    });
  });

  test("parses Shared Chat metadata from USERNOTICE", () => {
    const message = service.parseMessageLine(
      "@badges=;color=#9146ff;display-name=SharedSub;id=delivered-notice;login=sharedsub;mod=0;msg-id=sub;room-id=100;source-badges=subscriber/3;source-id=original-notice;source-room-id=200;subscriber=0;user-id=8 :tmi.twitch.tv USERNOTICE #target :shared subscription",
    );

    expect(message).toMatchObject({
      id: "delivered-notice",
      sourceMessageId: "original-notice",
      sourceChannelId: "200",
      targetChannelId: "100",
      badges: ["subscriber/3"],
      targetBadges: [],
    });
  });
});
