import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineIcon,
  TimelineItem,
  TimelineTimestamp,
  TimelineTitle,
} from "@oppulence/design-system";
import {
  CheckIcon,
  GitCommitIcon,
  MessageSquareIcon,
  UserIcon,
} from "lucide-react";

const meta = {
  title: "Molecules/Timeline",
  component: Timeline,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[400px]">
      <Timeline>
        <TimelineItem>
          <TimelineConnector />
          <TimelineIcon>
            <GitCommitIcon />
          </TimelineIcon>
          <TimelineContent>
            <TimelineTitle>Initial commit</TimelineTitle>
            <TimelineDescription>Created the repository</TimelineDescription>
            <TimelineTimestamp>2 hours ago</TimelineTimestamp>
          </TimelineContent>
        </TimelineItem>
        <TimelineItem>
          <TimelineConnector />
          <TimelineIcon>
            <MessageSquareIcon />
          </TimelineIcon>
          <TimelineContent>
            <TimelineTitle>Code review</TimelineTitle>
            <TimelineDescription>Reviewed pull request #42</TimelineDescription>
            <TimelineTimestamp>1 hour ago</TimelineTimestamp>
          </TimelineContent>
        </TimelineItem>
        <TimelineItem>
          <TimelineIcon>
            <UserIcon />
          </TimelineIcon>
          <TimelineContent>
            <TimelineTitle>Team meeting</TimelineTitle>
            <TimelineDescription>Discussed Q2 roadmap</TimelineDescription>
            <TimelineTimestamp>30 minutes ago</TimelineTimestamp>
          </TimelineContent>
        </TimelineItem>
      </Timeline>
    </div>
  ),
};

export const WithVariants: Story = {
  render: () => (
    <div className="w-[400px]">
      <Timeline>
        <TimelineItem>
          <TimelineConnector />
          <TimelineIcon variant="success">
            <CheckIcon />
          </TimelineIcon>
          <TimelineContent>
            <TimelineTitle>Deployment succeeded</TimelineTitle>
            <TimelineDescription>
              v2.1.0 deployed to production
            </TimelineDescription>
          </TimelineContent>
        </TimelineItem>
        <TimelineItem>
          <TimelineConnector />
          <TimelineIcon variant="warning">
            <MessageSquareIcon />
          </TimelineIcon>
          <TimelineContent>
            <TimelineTitle>Performance warning</TimelineTitle>
            <TimelineDescription>
              Response time exceeded 500ms
            </TimelineDescription>
          </TimelineContent>
        </TimelineItem>
        <TimelineItem>
          <TimelineIcon variant="destructive">
            <GitCommitIcon />
          </TimelineIcon>
          <TimelineContent>
            <TimelineTitle>Build failed</TimelineTitle>
            <TimelineDescription>
              TypeScript compilation error
            </TimelineDescription>
          </TimelineContent>
        </TimelineItem>
      </Timeline>
    </div>
  ),
};
