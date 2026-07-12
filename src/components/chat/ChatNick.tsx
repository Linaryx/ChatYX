import type { JSX } from "solid-js";
import type { TwitchMessage } from "~/services/chat";

type ChatNickProps = {
  message: TwitchMessage;
  nickStyle: string;
  fontWeight: string;
  paintClasses: string;
  paintAttributes: Record<string, string>;
  colonColor: string;
  isAction: boolean;
  uppercase: boolean;
};

export const ChatNick = (props: ChatNickProps): JSX.Element => {
  const {
    message,
    nickStyle,
    fontWeight,
    paintClasses,
    paintAttributes,
    colonColor,
    isAction,
    uppercase,
  } = props;
  const displayName = message.displayName || message.username;

  return (
    <span class="user_info">
      <span
        class={`nick ${paintClasses}`}
        style={`${nickStyle} font-weight: ${fontWeight};`}
        {...paintAttributes}
      >
        {uppercase ? displayName.toUpperCase() : displayName}
      </span>
      {isAction ? (
        <span>&nbsp;</span>
      ) : (
        <span
          class="colon"
          style={{ color: colonColor, "font-weight": fontWeight }}
        >
          :
        </span>
      )}
    </span>
  );
};
