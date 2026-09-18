# Contributing to ChatYX

## Commit Messages

ChatYX uses [Conventional Commits](https://www.conventionalcommits.org/).
Follow the concise conventions from the [Conventional Commits Cheatsheet](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13).

Use this format:

```text
<type>(<optional scope>): <description>
```

- Use an imperative, lower-case description without a trailing period.
- Keep scopes meaningful to the project, such as `setup`, `chat`, `config`, or `youtube`.
- Do not use issue identifiers as scopes.
- Mark breaking changes with `!` before `:` and explain them in a `BREAKING CHANGE:` footer.

### Types

| Type | Use for |
| --- | --- |
| `feat` | User-visible API or UI functionality |
| `fix` | Bug fixes |
| `refactor` | Code restructuring without behavior changes |
| `perf` | Performance-focused refactoring |
| `style` | Formatting-only changes |
| `test` | Adding or correcting tests |
| `docs` | Documentation-only changes |
| `build` | Build tools, dependencies, or versions |
| `ops` | CI/CD, deployment, or other operational changes |
| `chore` | Maintenance tasks that do not fit another type |

Examples:

```text
feat(setup): add granular badge controls
fix(chat): prevent duplicate platform badges
docs: explain OBS browser source setup
```

## Verification

Run the full project check before opening a pull request:

```bash
bun run check
```
