import { describe, expect, test } from "bun:test";
import { parseAzureVoiceCatalog } from "../src/components/setup/AzureVoiceCatalog";

describe("Azure voice catalog", () => {
  test("parses and sorts voices from voices.txt", () => {
    const voices = parseAzureVoiceCatalog(`
Name                               Gender    ContentCategories      VoicePersonalities
---------------------------------  --------  ---------------------  --------------------------------------
ru-RU-SvetlanaNeural               Female    General                Friendly, Positive
ru-RU-DmitryNeural                 Male      General                Friendly, Positive
`);

    expect(voices).toEqual([
      {
        voice: "ru-RU-DmitryNeural",
        locale: "ru-RU",
        gender: "Male",
        categories: "General",
        personalities: "Friendly, Positive",
      },
      {
        voice: "ru-RU-SvetlanaNeural",
        locale: "ru-RU",
        gender: "Female",
        categories: "General",
        personalities: "Friendly, Positive",
      },
    ]);
  });

  test("ignores non-voice rows", () => {
    expect(parseAzureVoiceCatalog("not a voice\nru-RU-DmitryNeural")).toEqual([]);
  });
});
