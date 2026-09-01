# TTS Voice Catalogs

## ChatYX Providers

| Provider | Moderator command | Voice argument | Catalog |
| --- | --- | --- | --- |
| ChatIS / Streamlabs | `!chat tts [-s Voice] текст` | Provider voice name | [ChatIS reference list](https://gist.github.com/Linaryx/ccbd1314f74a2d39ecbea289b9636c15) |
| JustDavi Azure | `!chat azuretts [-v xx-XX-VoiceNeural] текст` | Exact Azure Neural voice ID | [live voices.txt](https://cdn.justdavi.dev/voices.txt) |

ChatYX passes a ChatIS voice name to the provider without a local allowlist. Azure names must match `xx-XX-NameNeural`; the setup page loads the current Azure catalog from `voices.txt`, so this document intentionally does not duplicate that mutable list.

## ChatIS / Streamlabs Voice Reference

This is a readable table of the named voices in the supplied ChatIS reference list. The provider remains authoritative: a name can be unavailable or change independently of ChatYX.

| Locale | Voices |
| --- | --- |
| Arabic | Zeina |
| Arabic (Gulf) | Hala, Zayd |
| Catalan | Arlet |
| Chinese (Cantonese) | Hiujin |
| Chinese (Mandarin) | Zhiyu |
| Czech | Jitka |
| Danish | Naja, Mads, Sofie |
| Dutch | Ruben, Lotte, Laura |
| Dutch (Belgian) | Lisa |
| English (Australian) | Russell, Nicole, Olivia |
| English (British) | Emma, Brian, Amy, Arthur |
| English (Indian) | Raveena, Aditi, Kajal |
| English (Ireland) | Niamh |
| English (New Zealand) | Aria |
| English (South African) | Ayanda |
| English (US) | Danielle, Gregory, Joanna, Ruth, Kevin, Salli, Matthew, Kimberly, Kendra, Justin, Joey, Ivy, Stephen |
| English (Welsh) | Geraint |
| Finnish | Suvi |
| French | Mathieu, Lea, Celine, Remi |
| French (Belgian) | Isabelle |
| French (Canadian) | Chantal, Gabrielle, Liam |
| German | Vicki, Marlene, Hans, Daniel |
| German (Austrian) | Hannah |
| Icelandic | Karl, Dora |
| Italian | Bianca, Giorgio, Carla, Adriano |
| Japanese | Kazuha, Tomoko, Takumi, Mizuki |
| Korean | Seoyeon |
| Norwegian | Ida, Liv |
| Polish | Maja, Jan, Jacek, Ewa, Ola |
| Portuguese (Brazilian) | Vitoria, Ricardo, Camila, Thiago |
| Portuguese (European) | Ines, Cristiano |
| Romanian | Carmen |
| Russian | Tatyana, Maxim |
| Spanish (European) | Lucia, Enrique, Conchita, Sergio |
| Spanish (Mexican) | Mia, Andres |
| Spanish (US) | Lupe, Penelope, Miguel, Pedro |
| Swedish | Elin, Astrid |
| Swiss Standard German | Sabrina |
| Turkish | Burcu, Filiz |
| Welsh | Gwyneth |

## Azure: Common Russian Voices

| Voice ID | Locale | Gender | Use with |
| --- | --- | --- | --- |
| `ru-RU-DmitryNeural` | `ru-RU` | Male | `!chat azuretts -v ru-RU-DmitryNeural текст` |
| `ru-RU-SvetlanaNeural` | `ru-RU` | Female | `!chat azuretts -v ru-RU-SvetlanaNeural текст` |

For the complete and current Azure catalog, use the table in **Озвучка сообщений** or open [voices.txt](https://cdn.justdavi.dev/voices.txt).

## Cyan Chat Comparison

Cyan Chat uses its own AWS Polly backend in `eu-north-1`; it maps 18 names (`Brian`, `Ivy`, `Justin`, `Russell`, `Nicole`, `Emma`, `Amy`, `Joanna`, `Salli`, `Kimberly`, `Kendra`, `Joey`, `Mizuki`, `Chantal`, `Mathieu`, `Maxim`, `Hans`, `Raveena`) to Polly voice IDs. Its endpoint limits text to 1000 characters and returns MP3. ChatYX instead uses the opt-in ChatIS and JustDavi providers through the RTE proxy.

Sources: [Cyan Chat TTS handler](https://github.com/Johnnycyan/cyan-chat/blob/main/main.go), [Azure voices.txt](https://cdn.justdavi.dev/voices.txt), [ChatIS reference list](https://gist.github.com/Linaryx/ccbd1314f74a2d39ecbea289b9636c15).
