import { createUniqueId } from "solid-js";
import "./ConnectionInterrupted.css";

export function ConnectionInterrupted() {
  const clipId = `chat-disconnect-clip-${createUniqueId()}`;

  return (
    <div class="chat-connection-status" role="status" aria-live="polite" aria-atomic="true">
      <svg
        class="chat-disconnect-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g clip-path={`url(#${clipId})`} stroke-width="1.5" stroke-linecap="round">
          <path class="chat-disconnect-center" transform="translate(10 12)" d="M4 2C4 3.1046 3.1046 4 2 4C0.8954 4 0 3.1046 0 2C0 0.8954 0.8954 0 2 0" stroke="#444444" />
          <path class="chat-disconnect-outer-left" transform="translate(2 6)" d="M2 14.001C0.74418 12.3295 0 10.2516 0 8C0 4.7288 1.57069 1.82446 3.99903 0" stroke="#444444" />
          <path class="chat-disconnect-outer-right" transform="translate(8.5 4)" d="M0 0.62961C1.08934 0.22255 2.2687 0 3.5 0C9.0228 0 13.5 4.47715 13.5 10C13.5 11.2313 13.2775 12.4107 12.8704 13.5" stroke="#444444" />
          <path class="chat-disconnect-inner-left" transform="translate(6 9)" d="M1.50087 9C0.56753 7.9385 0 6.5367 0 5C0 2.913 1.04673 1.0749 2.63494 0M10.2877 9C10.5573 8.6934 10.7963 8.3584 11 8" stroke="#444444" />
          <path class="chat-disconnect-inner-right" transform="translate(12 8)" d="M6 6C6 2.6863 3.3137 0 0 0" stroke="#444444" />
          <path class="chat-disconnect-slash" transform="translate(22 22) rotate(180)" d="M0 0L20 20" pathLength="1" stroke="#F26969" stroke-dasharray="0.0001 1" stroke-dashoffset="-0.9999" />
        </g>
        <defs>
          <clipPath id={clipId}>
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
      <span class="chat-connection-caption">нет подключения</span>
    </div>
  );
}
