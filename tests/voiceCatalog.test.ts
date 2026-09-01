import { describe, expect, test } from "bun:test";
import { parseVoiceCatalog } from "../src/components/setup/VoiceCatalog";

describe("voice catalog", () => {
  test("parses and sorts separate provider tables", () => {
    const voices = parseVoiceCatalog(`
[JustDavi / Azure]
| Voice | Locale | Gender | Features |
| --- | --- | --- | --- |
| ru-RU-SvetlanaNeural | ru-RU | Female | General |
[ChatIS / Streamlabs]
| Voice | Locale | Gender | Features |
| --- | --- | --- | --- |
| Maxim | Russian | N/A | Streamlabs |
[Cyan Chat / AWS Polly]
| Voice | Locale | Gender | Features |
| --- | --- | --- | --- |
| Maxim | Russian | N/A | AWS Polly subset |

`);
    expect(voices).toEqual([
      {
        provider: "ChatIS / Streamlabs",
        voice: "Maxim",
        locale: "Russian",
        gender: "N/A",
        features: "Streamlabs",
      },
      {
        provider: "Cyan Chat / AWS Polly",
        voice: "Maxim",
        locale: "Russian",
        gender: "N/A",
        features: "AWS Polly subset",
      },
      {
        provider: "JustDavi / Azure",
        voice: "ru-RU-SvetlanaNeural",
        locale: "ru-RU",
        gender: "Female",
        features: "General",
      },
    ]);
  });

  test("ignores malformed rows and unknown tables", () => {
    expect(
      parseVoiceCatalog(`
[Unknown]
| Voice | Locale | Gender | Features |
| Nope | N/A | N/A | N/A |
[JustDavi / Azure]
| Voice | Locale | Gender | Features |
| --- | --- | --- | --- |
| ru-RU-DmitryNeural |
`),
    ).toEqual([]);
  });
});
