# Contributing

## Local Flow

1. Make focused changes
2. Run `bun run harness:validate`
3. Commit with a conventional commit
4. Open a PR

## Commands

```bash
bun run harness:doctor
bun run harness:discover
bun run harness:plan
bun run harness:validate
```

## Commit Format

```text
type(scope): description
```

Allowed types:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `harness`

## Agent Rule

Before handoff, always run `bun run harness:validate`.
