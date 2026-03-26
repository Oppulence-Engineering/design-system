import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@oppulence/design-system";

const meta = {
  title: "Molecules/Stepper",
  component: Stepper,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[600px]">
      <Stepper activeStep={1} orientation="horizontal">
        <StepperItem step={0}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Account</StepperTitle>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={1}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Profile</StepperTitle>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={2}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Review</StepperTitle>
          </StepperTrigger>
        </StepperItem>
      </Stepper>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="w-[400px]">
      <Stepper activeStep={1} orientation="vertical">
        <StepperItem step={0}>
          <StepperTrigger>
            <StepperIndicator />
            <div>
              <StepperTitle>Create account</StepperTitle>
              <StepperDescription>Set up your credentials</StepperDescription>
            </div>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={1}>
          <StepperTrigger>
            <StepperIndicator />
            <div>
              <StepperTitle>Add profile</StepperTitle>
              <StepperDescription>Tell us about yourself</StepperDescription>
            </div>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={2}>
          <StepperTrigger>
            <StepperIndicator />
            <div>
              <StepperTitle>Get started</StepperTitle>
              <StepperDescription>Start using the platform</StepperDescription>
            </div>
          </StepperTrigger>
        </StepperItem>
      </Stepper>
    </div>
  ),
};

export const WithContent: Story = {
  render: () => (
    <div className="w-[600px]">
      <Stepper activeStep={1} orientation="horizontal">
        <StepperItem step={0}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Account</StepperTitle>
          </StepperTrigger>
          <StepperContent>
            <p className="text-sm text-muted-foreground">
              Account setup content here.
            </p>
          </StepperContent>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={1}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Profile</StepperTitle>
          </StepperTrigger>
          <StepperContent>
            <p className="text-sm text-muted-foreground">
              This is the active step content.
            </p>
          </StepperContent>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={2}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Review</StepperTitle>
          </StepperTrigger>
        </StepperItem>
      </Stepper>
    </div>
  ),
};
