import { describe, expect, test } from "bun:test";
import { parseVoiceCatalog } from "../src/components/setup/VoiceCatalog";

describe("voice catalog", () => {
  test("parses and sorts the Russian provider tables", () => {
    const voices = parseVoiceCatalog(`
[JustDavi / Azure]
| Voice | Locale | Gender | Features |
| --- | --- | --- | --- |
| Dmitry | Russian | Male | Azure Neural |
| Svetlana | Russian | Female | Azure Neural |
[ChatIS / Streamlabs]
| Voice | Locale | Gender | Features |
| --- | --- | --- | --- |
| Maxim | Russian | Male | Streamlabs |
| Tatyana | Russian | Female | Streamlabs |

`);
    expect(voices).toEqual([
      {
        provider: "ChatIS / Streamlabs",
        voice: "Maxim",
        locale: "Russian",
        gender: "Male",
        features: "Streamlabs",
      },
      {
        provider: "ChatIS / Streamlabs",
        voice: "Tatyana",
        locale: "Russian",
        gender: "Female",
        features: "Streamlabs",
      },
      {
        provider: "JustDavi / Azure",
        voice: "Dmitry",
        locale: "Russian",
        gender: "Male",
        features: "Azure Neural",
      },
      {
        provider: "JustDavi / Azure",
        voice: "Svetlana",
        locale: "Russian",
        gender: "Female",
        features: "Azure Neural",
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
