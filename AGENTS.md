# ChatYX Agent Instructions

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit.
Follow the project rules in [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Conventional Commits Cheatsheet](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13).

- Format: `<type>(<optional scope>): <description>`.
- Use an imperative, lower-case description without a trailing period.
- Use a logical project area as the scope; do not use issue IDs as scopes.
- Use `!` and a `BREAKING CHANGE:` footer for breaking changes.
- Run `bun run check` before committing when practical.
