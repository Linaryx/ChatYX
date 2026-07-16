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
  const displayName = () => props.message.displayName || props.message.username;

  return (
    <span class="user_info">
      <span
        class={`nick ${props.paintClasses}`}
        style={`${props.nickStyle} font-weight: ${props.fontWeight};`}
        {...props.paintAttributes}
      >
        {props.uppercase ? displayName().toUpperCase() : displayName()}
      </span>
      {props.isAction ? (
        <span>&nbsp;</span>
      ) : (
        <span
          class="colon"
          style={{ color: props.colonColor, "font-weight": props.fontWeight }}
        >
          :
        </span>
      )}
    </span>
  );
};
