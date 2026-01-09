# Design System Monorepo

A Turborepo containing the design system component library and Storybook documentation.

## Packages

- `@oppulence/design-system` - React component library with Tailwind CSS
- `@comp/storybook` - Storybook documentation and component playground

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

## Building

Build all packages:

```sh
bun run build
```

Build a specific package:

```sh
bun run build --filter=@oppulence/design-system
```
