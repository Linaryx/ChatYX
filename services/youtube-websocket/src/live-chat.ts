import { YTNodes } from "youtubei.js/web";
import { textMessageToEvent, paidMessageToEvent } from "./adapters";
import { getInnertube } from "./youtube";

type SendEvent = (event: unknown) => void;
type CloseConnection = (reason: string) => void;

export type LiveChatSession = {
  stop: () => void;
};

function speedUpPolling(liveChat: any, pollIntervalMs: number) {
  const queue = liveChat?.smoothed_queue;
  if (!queue?.callback || typeof queue.enqueueActionGroup !== "function") {
    return;
  }

  const originalCallback = queue.callback;
  const noopActions = Array.from({ length: 10 }, () => ({
    is: () => false,
  }));

  queue.enqueueActionGroup = (group: unknown) => {
    for (const action of [group].flat()) {
      liveChat.emit("chat-update", action);
    }

    setTimeout(() => originalCallback(noopActions), pollIntervalMs);
  };
}

export async function connectLiveChat(
  videoId: string,
  send: SendEvent,
  close: CloseConnection,
  onEnd?: () => void,
): Promise<LiveChatSession> {
  const youtube = await getInnertube();
  const streamInfo = await youtube.getInfo(videoId);
  const liveChat = streamInfo.getLiveChat();
  let stopped = false;

  if (!liveChat) {
    throw new Error(`Video ${videoId} has no available live chat`);
  }

  speedUpPolling(liveChat, 1000);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveChat.stop();
  };

  liveChat.on("start", () => {
    liveChat.applyFilter("LIVE_CHAT");
  });

  liveChat.on("chat-update", (action: any) => {
    if (stopped) return;

    if (action.is(YTNodes.MarkChatItemAsDeletedAction)) {
      const deleted = action.as(YTNodes.MarkChatItemAsDeletedAction);
      send({ info: "deleted", message: deleted.target_item_id });
      return;
    }

    if (action.is(YTNodes.RemoveChatItemAction)) {
      const removed = action.as(YTNodes.RemoveChatItemAction);
      send({ info: "deleted", message: removed.target_item_id });
      return;
    }

    if (
      action.is(YTNodes.MarkChatItemsByAuthorAsDeletedAction) ||
      action.is(YTNodes.RemoveChatItemByAuthorAction)
    ) {
      const banned = action.is(YTNodes.MarkChatItemsByAuthorAsDeletedAction)
        ? action.as(YTNodes.MarkChatItemsByAuthorAsDeletedAction)
        : action.as(YTNodes.RemoveChatItemByAuthorAction);
      send({
        info: "banned",
        externalChannelId: banned.external_channel_id,
      });
      return;
    }

    if (!action.is(YTNodes.AddChatItemAction)) return;

    const item = action.as(YTNodes.AddChatItemAction).item;
    if (!item) return;

    switch (item.type) {
      case "LiveChatTextMessage":
        send(textMessageToEvent(item.as(YTNodes.LiveChatTextMessage)));
        break;
      case "LiveChatPaidMessage":
        send(paidMessageToEvent(item.as(YTNodes.LiveChatPaidMessage)));
        break;
    }
  });

  liveChat.on("end", () => {
    stop();
    if (onEnd) {
      onEnd();
    } else {
      close("Live chat has ended");
    }
  });

  liveChat.start();
  return { stop };
}
