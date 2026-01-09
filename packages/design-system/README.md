# @oppulence/design-system

A shadcn-style design system with Tailwind CSS v4. Ships raw TypeScript/TSX source files that your app compiles directly.

## Installation

```bash
npm install @oppulence/design-system
# or
bun add @oppulence/design-system
```

## Setup in Next.js

### 1. Configure Tailwind CSS

Add the design system to your `tailwind.config.ts` content paths:

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    // Include the design system components
    './node_modules/@oppulence/design-system/src/**/*.{js,ts,jsx,tsx}',
  ],
  // ... rest of your config
};

export default config;
```

### 2. Import Global Styles

Import the design system's CSS in your root layout:

```tsx
// app/layout.tsx
import '@oppulence/design-system/globals.css';
// or import alongside your own globals
import './globals.css';
```

### 3. Configure Next.js to Transpile

Add the package to `transpilePackages` in your `next.config.ts`:

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@oppulence/design-system'],
};

export default nextConfig;
```

## Usage

Import components directly:

```tsx
import { Button, Card, CardHeader, CardContent } from '@oppulence/design-system';

export function MyComponent() {
  return (
    <Card>
      <CardHeader>Hello</CardHeader>
      <CardContent>
        <Button variant="outline">Click me</Button>
      </CardContent>
    </Card>
  );
}
```

## Available Exports

| Export                                     | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `@oppulence/design-system`                 | All components                     |
| `@oppulence/design-system/cn`              | `cn()` utility for merging classes |
| `@oppulence/design-system/globals.css`     | Global CSS with theme variables    |
| `@oppulence/design-system/tailwind.config` | Tailwind configuration             |

## Components

The design system includes:

- **Layout**: `Container`, `Stack`, `Grid`, `PageLayout`, `Section`
- **Typography**: `Heading`, `Text`
- **Forms**: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Label`, `Field`
- **Data Display**: `Card`, `Badge`, `Avatar`, `Table`, `Progress`
- **Feedback**: `Alert`, `AlertDialog`, `Dialog`, `Sheet`, `Drawer`, `Tooltip`, `Popover`
- **Navigation**: `Tabs`, `Breadcrumb`, `Pagination`, `NavigationMenu`, `DropdownMenu`
- **Utility**: `Separator`, `Skeleton`, `Spinner`, `ScrollArea`, `Collapsible`

## Design Principles

- **No className prop**: Components use variants and props, not className overrides
- **Semantic tokens**: Uses CSS variables for consistent theming
- **Dark mode**: Full dark mode support via `next-themes`
- **Accessible**: Built on Radix UI primitives

## License

MIT
