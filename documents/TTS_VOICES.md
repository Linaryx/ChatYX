# TTS Voice Catalog

ChatYX uses one moderator command for both speech providers:

```text
!chat tts [-s Voice] текст
```

Available Russian voices:

| Name | Provider | Backend voice |
| --- | --- | --- |
| `Maxim` | ChatIS / Streamlabs | `Maxim` |
| `Tatyana` | ChatIS / Streamlabs | `Tatyana` |
| `Dmitriy` | JustDavi / Azure | `ru-RU-DmitryNeural` |
| `Dmitry` | JustDavi / Azure | `ru-RU-DmitryNeural` |
| `Svetlana` | JustDavi / Azure | `ru-RU-SvetlanaNeural` |

Examples:

```text
!chat tts -s Maxim Привет, чат!
!chat tts -s Svetlana Добрый вечер!
```

The provider is selected automatically from the voice name. Without `-s`,
ChatYX uses ChatIS when it is enabled, otherwise Azure. The provider must be
enabled in the setup page. Queue controls remain available through the same
command: `!chat tts skip`, `!chat tts stop`, and `!chat tts clear`.

The local catalog is available at [`/voices.txt`](/voices.txt).
