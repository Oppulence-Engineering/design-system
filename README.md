# Oppulence Shared Packages

A Turborepo containing Oppulence's design system and independently versioned shared packages.

## Packages

- `@oppulence/design-system` - React component library with Tailwind CSS
- `@oppulence/auth` - WorkOS-backed authentication primitives
- `@oppulence/infinite-canvas` - Collaborative spatial editor
- `@oppulence/core` - Runtime utilities and typed socket primitives
- `@oppulence/desktop-client` - Tauri desktop utilities
- `@oppulence/e-invoicing` - Peppol/UBL e-invoicing primitives
- `@oppulence/events` - Typed analytics events and OpenPanel adapters
- `@oppulence/import` - Financial transaction import primitives
- `@comp/storybook` - Storybook documentation and component playground

## Architecture RFCs

Proposed cross-package decisions live in [docs/rfcs](./docs/rfcs/README.md).

## Getting Started

Install dependencies:

```sh
bun install
```

## Development

Run Storybook:

```sh
bun storybook
```

This starts Storybook at http://localhost:6006

## Commands

| Command             | Description                |
| ------------------- | -------------------------- |
| `bun storybook`     | Start Storybook dev server |
| `bun run build`     | Build all packages         |
| `bun run typecheck` | Type check all packages    |
| `bun run lint`      | Lint all packages          |
| `bun test`          | Run tests                  |
| `bun run format`    | Format code with Prettier  |

## Ralph (Autonomous Agent Loop)

Ralph runs Claude Code in a loop to work through tasks from a PRD. Each iteration picks up one task, implements it, commits, and logs progress.

### Files

| File | Purpose |
|------|---------|
| `PRD.md` | Your requirements document -- Ralph reads this to find what to build next |
| `progress.txt` | Tracks completed work across iterations |
| `ralph-once.sh` | Human-in-the-loop -- runs one task, pauses for review |
| `afk-ralph.sh` | Fully autonomous -- runs N iterations in a Docker sandbox |

### Usage

**Create a PRD first.** Use Claude's plan mode (`claude` then `shift-tab`) or write one manually.

```bash
# Interactive: one task at a time, review between runs
./ralph-once.sh

# Autonomous: run up to 20 tasks unattended in Docker sandbox
./afk-ralph.sh 20
```

The AFK version uses `docker sandbox run` for isolation. It stops early if Claude determines the PRD is complete.

**First-time setup for AFK mode:**
```bash
docker sandbox run claude
```

See [Getting Started with Ralph](https://www.aihero.dev/getting-started-with-ralph) for the full walkthrough.

---

## Building

Build all packages:

```sh
bun run build
```

Build a specific package:

```sh
bun run build --filter=@oppulence/design-system
```
