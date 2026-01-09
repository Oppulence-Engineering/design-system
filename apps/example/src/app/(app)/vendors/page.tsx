'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  HStack,
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageLayout,
  Stack,
  Text,
} from '@oppulence/design-system';
import { ExternalLinkIcon, MoreHorizontalIcon, PlusIcon, ShieldCheckIcon } from 'lucide-react';

const vendors = [
  {
    id: 1,
    name: 'Amazon Web Services',
    category: 'Cloud Infrastructure',
    riskLevel: 'low',
    status: 'approved',
    lastAssessment: 'Dec 15, 2023',
    logo: 'https://logo.clearbit.com/aws.amazon.com',
  },
  {
    id: 2,
    name: 'Google Cloud Platform',
    category: 'Cloud Infrastructure',
    riskLevel: 'low',
    status: 'approved',
    lastAssessment: 'Dec 10, 2023',
    logo: 'https://logo.clearbit.com/cloud.google.com',
  },
  {
    id: 3,
    name: 'Slack',
    category: 'Communication',
    riskLevel: 'medium',
    status: 'approved',
    lastAssessment: 'Nov 28, 2023',
    logo: 'https://logo.clearbit.com/slack.com',
  },
  {
    id: 4,
    name: 'Salesforce',
    category: 'CRM',
    riskLevel: 'medium',
    status: 'pending',
    lastAssessment: 'Nov 15, 2023',
    logo: 'https://logo.clearbit.com/salesforce.com',
  },
  {
    id: 5,
    name: 'Datadog',
    category: 'Monitoring',
    riskLevel: 'low',
    status: 'approved',
    lastAssessment: 'Oct 30, 2023',
    logo: 'https://logo.clearbit.com/datadoghq.com',
  },
  {
    id: 6,
    name: 'Stripe',
    category: 'Payments',
    riskLevel: 'high',
    status: 'review',
    lastAssessment: 'Oct 15, 2023',
    logo: 'https://logo.clearbit.com/stripe.com',
  },
];

function getRiskBadge(risk: string) {
  switch (risk) {
    case 'low':
      return <Badge>Low Risk</Badge>;
    case 'medium':
      return <Badge variant="secondary">Medium Risk</Badge>;
    case 'high':
      return <Badge variant="destructive">High Risk</Badge>;
    default:
      return <Badge variant="outline">{risk}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <HStack gap="1" align="center">
          <ShieldCheckIcon className="size-4 text-green-600" />
          <Text size="sm">Approved</Text>
        </HStack>
      );
    case 'pending':
      return <Text size="sm" variant="muted">Pending Review</Text>;
    case 'review':
      return <Text size="sm" variant="muted">Under Review</Text>;
    default:
      return <Text size="sm" variant="muted">{status}</Text>;
  }
}

function VendorCard({ vendor }: { vendor: typeof vendors[0] }) {
  return (
    <Card>
      <CardContent>
        <Stack gap="4">
          <HStack justify="between" align="start">
            <HStack gap="3" align="center">
              <Avatar size="lg">
                <AvatarImage src={vendor.logo} />
                <AvatarFallback>{vendor.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Stack gap="none">
                <Text weight="semibold">{vendor.name}</Text>
                <Text size="sm" variant="muted">{vendor.category}</Text>
              </Stack>
            </HStack>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontalIcon />
            </Button>
          </HStack>

          <HStack justify="between" align="center">
            {getRiskBadge(vendor.riskLevel)}
            {getStatusBadge(vendor.status)}
          </HStack>

          <HStack justify="between" align="center">
            <Text size="xs" variant="muted">Last assessment: {vendor.lastAssessment}</Text>
            <Button variant="ghost" size="xs">
              <ExternalLinkIcon className="size-3" />
              View Details
            </Button>
          </HStack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function VendorsPage() {
  return (
    <PageLayout padding="none" container={false}>
      <PageHeader title="Vendors">
        <PageHeaderDescription>
          Manage third-party vendors and track their security assessments.
        </PageHeaderDescription>
        <PageHeaderActions>
          <Button iconLeft={<PlusIcon />}>Add Vendor</Button>
        </PageHeaderActions>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vendors.map((vendor) => (
          <VendorCard key={vendor.id} vendor={vendor} />
        ))}
      </div>
    </PageLayout>
  );
}
