import type { JSX } from "solid-js";
import type { TwitchMessage } from "~/services/chat";

type ChatNickProps = {
  message: TwitchMessage;
  nickStyle: string;
  paintClasses: string;
  paintAttributes: Record<string, string>;
  colonColor: string;
  isAction: boolean;
};

export const ChatNick = (props: ChatNickProps): JSX.Element => {
  const {
    message,
    nickStyle,
    paintClasses,
    paintAttributes,
    colonColor,
    isAction,
  } = props;

  return (
    <span class="user_info">
      <span
        class={`nick ${paintClasses}`}
        style={nickStyle}
        {...paintAttributes}
      >
        {message.displayName || message.username}
      </span>
      {isAction ? (
        <span>&nbsp;</span>
      ) : (
        <span class="colon" style={{ color: colonColor }}>
          :
        </span>
      )}
    </span>
  );
};
