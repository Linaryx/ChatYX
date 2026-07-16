import { createMemo, type JSX } from "solid-js";
import type { ChatConfig } from "~/utils/chat";
import type { TwitchMessage, ChatPresentationService } from "~/services/chat";
import { badgeService } from "~/services/badges";
import {
  isTwitchRoleBadge,
  isTwitchSubBadge,
  isTwitchVanityBadge,
  flattenBadgeRenderOrder,
  orderThirdPartyBadges,
  ROLE_BADGE_ORDER,
  SUB_BADGE_ORDER,
} from "~/utils/chat/badgePriority";

type ChatBadgesProps = {
  message: TwitchMessage;
  config: ChatConfig;
  service: ChatPresentationService;
};

export const ChatBadges = (props: ChatBadgesProps): JSX.Element => {
  const renderedBadges = createMemo(() => {
    const { message, config, service } = props;
    const badges: JSX.Element[] = [];

  if (message.badges?.length) {
    const roleBadgeMap = new Map<string, JSX.Element>();
    const vanityBadgeElements: JSX.Element[] = [];
    const subBadgeMap = new Map<string, JSX.Element>();
    const predictionBadges: JSX.Element[] = [];

    const isFfzBotBadge = (badge: any) => {
      if (badge?.source !== "ffz") return false;
      const label = String(
        badge.description || badge.title || "",
      ).toLowerCase();
      return label.includes("bot");
    };

    const thirdPartyBadges = service.getBadges(message.username);
    const ffzBotBadge = thirdPartyBadges.find((badge) => isFfzBotBadge(badge));
    const enhancedBadges = thirdPartyBadges.filter(
      (badge) => !isFfzBotBadge(badge),
    );
    let mixedBotRendered = false;

    const hasVipBadge = message.badges.some((badge) =>
      badge.startsWith("vip/"),
    );

    const shouldMixWithRole = (role: "broadcaster" | "moderator" | "vip") => {
      if (!ffzBotBadge) return false;
      if (config.ffzBotMixCustom) {
        if (role === "broadcaster") return config.ffzBotMixBroadcaster;
        if (role === "moderator") return config.ffzBotMixModerator;
        return config.ffzBotMixVip;
      }
      switch (config.ffzBotMix) {
        case 2:
          return role === "moderator";
        case 3:
          return false;
        case 1:
        default:
          return role === "moderator" && !hasVipBadge;
      }
    };

    message.badges.forEach((badge) => {
      const [badgeName, badgeVersion] = badge.split("/");
      const badgeUrl = badgeService.getTwitchBadge(badgeName, badgeVersion);

      if (badgeUrl) {
        const roleType =
          badgeName === "broadcaster"
            ? "broadcaster"
            : badgeName === "moderator" || badgeName === "lead_moderator"
              ? "moderator"
              : "vip";

        if (
          ffzBotBadge?.url &&
          isTwitchRoleBadge(badgeName) &&
          shouldMixWithRole(roleType)
        ) {
          const mixColor =
            roleType === "broadcaster"
              ? "#e91916"
              : roleType === "moderator"
                ? "#00ad03"
                : "#e005b9";
          const mixedBadgeElement = (
            <span
              class="badge ffz-bot-mix"
              style={{ "background-color": mixColor }}
              title={ffzBotBadge.title || ffzBotBadge.description || "FFZ Bot"}
            >
              <img src={ffzBotBadge.url} alt="FFZ Bot" />
            </span>
          );
          mixedBotRendered = true;

          roleBadgeMap.set(badgeName, mixedBadgeElement);
          return;
        }

        const badgeElement = (
          <img class="badge" src={badgeUrl} alt={badgeName} />
        );

        if (badgeName === "predictions") {
          predictionBadges.push(badgeElement);
        } else if (isTwitchRoleBadge(badgeName)) {
          if (!roleBadgeMap.has(badgeName)) {
            roleBadgeMap.set(badgeName, badgeElement);
          }
        } else if (isTwitchSubBadge(badgeName)) {
          if (!subBadgeMap.has(badgeName)) {
            subBadgeMap.set(badgeName, badgeElement);
          }
        } else if (isTwitchVanityBadge(badgeName)) {
          vanityBadgeElements.push(badgeElement);
        } else {
          vanityBadgeElements.push(badgeElement);
        }
      }
    });

    const orderedRoleBadges = [
      ...ROLE_BADGE_ORDER.map((name) => roleBadgeMap.get(name)).filter(Boolean),
      ...Array.from(roleBadgeMap.entries())
        .filter(([name]) => !ROLE_BADGE_ORDER.includes(name as any))
        .map(([, element]) => element),
    ];
    const orderedSubBadges = [
      ...SUB_BADGE_ORDER.map((name) => subBadgeMap.get(name)).filter(Boolean),
      ...Array.from(subBadgeMap.entries())
        .filter(([name]) => !SUB_BADGE_ORDER.includes(name as any))
        .map(([, element]) => element),
    ];

    const { homies, vanity, chatterino, ffz_sub, ffz, other } =
      orderThirdPartyBadges(enhancedBadges);

    const mapThirdPartyBadges = (list: typeof homies): JSX.Element[] =>
      list
        .filter((badge) => badge.url)
        .map((badge) => {
          const badgeStyle =
            badge.source === "ffzap"
              ? { "background-color": "#000" }
              : badge.color
                ? { "background-color": badge.color }
                : undefined;
          return (
            <img
              class="badge"
              src={badge.url}
              title={badge.title || badge.source}
              alt={badge.title || badge.source}
              style={badgeStyle}
            />
          );
        });

    const orderedBadges = flattenBadgeRenderOrder({
      role: orderedRoleBadges,
      homies: config.showHomies ? mapThirdPartyBadges(homies) : [],
      sub: orderedSubBadges,
      vanity: [...vanityBadgeElements, ...mapThirdPartyBadges(vanity)],
      chatterino: mapThirdPartyBadges(chatterino),
      ffz_sub: mapThirdPartyBadges(ffz_sub),
      ffz: mapThirdPartyBadges(ffz),
      other: mapThirdPartyBadges(other),
    });

    badges.push(...predictionBadges, ...orderedBadges);

    if (ffzBotBadge?.url && !mixedBotRendered) {
      badges.push(
        <img
          class="badge ffz-bot"
          src={ffzBotBadge.url}
          title={ffzBotBadge.title || ffzBotBadge.description || "FFZ Bot"}
          alt="FFZ Bot"
        />,
      );
    }
  } else {
    let badgeUrl: string | null = null;
    if (message.isModerator) {
      badgeUrl = badgeService.getTwitchBadge("moderator", "1") || null;
    } else if (message.isSubscriber) {
      badgeUrl = badgeService.getTwitchBadge("subscriber", "1") || null;
    } else if (message.userType === "vip") {
      badgeUrl = badgeService.getTwitchBadge("vip", "1") || null;
    }

    if (badgeUrl) {
      badges.push(<img class="badge" src={badgeUrl} alt="badge" />);
    }
  }

  message.platformBadges
    ?.filter((badge) => badge.url)
    .forEach((badge) => {
      const title = badge.title || "YouTube badge";
      badges.push(
        <img
          class="badge"
          src={badge.url}
          title={title}
          alt={title}
          loading="lazy"
        />,
      );
    });

    return badges;
  });

  return <>{renderedBadges()}</>;
};
