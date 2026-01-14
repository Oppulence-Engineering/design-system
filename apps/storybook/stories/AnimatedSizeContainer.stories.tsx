import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  AnimatedSizeContainer,
  Button,
  Card,
  CardContent,
  Stack,
} from "@oppulence/design-system";

const meta = {
  title: "Atoms/AnimatedSizeContainer",
  component: AnimatedSizeContainer,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AnimatedSizeContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [expanded, setExpanded] = useState(false);

    return (
      <Stack gap="4">
        <Button variant="outline" onClick={() => setExpanded(!expanded)}>
          Toggle Size
        </Button>
        <AnimatedSizeContainer width height>
          <Card>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm font-medium">Animated content</div>
                {expanded ? (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Extra content becomes visible.</p>
                    <p>The container animates to fit.</p>
                    <p>Resize to collapse again.</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Collapsed.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSizeContainer>
      </Stack>
    );
  },
};
