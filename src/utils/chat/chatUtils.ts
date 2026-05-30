// Утилиты для работы с параметрами чата из оригинального ChatIS

export type { ChatConfig } from "../../config/chatUrlParams";

export function escapeHtml(message: string): string {
  const div = document.createElement("div");
  div.textContent = message;
  return div.innerHTML;
}

export function parseEmotes(message: string, emotes: any): string {
  if (!emotes || Object.keys(emotes).length === 0) {
    return escapeHtml(message);
  }

  // Создаем объект замен как в v2
  const replacements: { [key: string]: string } = {};

  Object.entries(emotes).forEach(([emoteId, positions]: [string, any]) => {
    if (Array.isArray(positions)) {
      positions.forEach((pos: string) => {
        const [start, end] = pos.split("-").map(Number);
        // Убираем эмодзи из сообщения для поиска кода
        const emojis = new RegExp("[\u1000-\uFFFF]+", "g");
        const aux = message.replace(emojis, " ");
        const emoteCode = aux.substr(start, end - start + 1);

        // Создаем плейсхолдер для замены
        replacements[emoteCode] = `{{EMOTE:${emoteId}:${start}:${end}}}`;
      });
    }
  });

  // Сортируем ключи по длине (как в v2)
  const replacementKeys = Object.keys(replacements);
  replacementKeys.sort((a, b) => b.length - a.length);

  // Заменяем эмодзи
  let result = message;
  replacementKeys.forEach((replacementKey) => {
    const regex = new RegExp(
      "(?<!\\S)(" + escapeRegExp(replacementKey) + ")(?!\\S)",
      "g",
    );
    result = result.replace(regex, replacements[replacementKey]);
  });

  return escapeHtml(result);
}

export function strmax(str: string, length: number): string {
  return str.length > length ? str.substr(0, length - 3) + "..." : str;
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
