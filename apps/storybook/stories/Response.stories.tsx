import type { Meta, StoryObj } from "@storybook/react-vite";
import { Response } from "@oppulence/design-system";

const meta = {
  title: "Organisms/Response",
  component: Response,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Response>;

export default meta;
type Story = StoryObj<typeof meta>;

const markdown = `### Key takeaways
- Enterprise pipeline grew 18% quarter over quarter.
- EMEA renewals outperformed expectations.
- Marketing spend is stabilizing across regions.

#### Metrics snapshot
| Metric | Value |
| --- | --- |
| Pipeline coverage | 3.2x |
| Average deal size | $42k |
| Churn | 2.1% |

[Read the full brief](https://example.com/brief) or check the /docs link.`;

export const Default: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <Response>{markdown}</Response>
    </div>
  ),
};
