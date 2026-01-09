'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Grid,
  HStack,
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageLayout,
  Progress,
  Stack,
  Text,
} from '@oppulence/design-system';
import { CheckCircleIcon, CircleIcon, FilterIcon } from 'lucide-react';

const controlCategories = [
  {
    id: 'access-control',
    name: 'Access Control',
    description: 'User authentication and authorization controls',
    total: 24,
    passed: 20,
    failed: 2,
    pending: 2,
  },
  {
    id: 'data-protection',
    name: 'Data Protection',
    description: 'Encryption and data handling controls',
    total: 18,
    passed: 15,
    failed: 1,
    pending: 2,
  },
  {
    id: 'network-security',
    name: 'Network Security',
    description: 'Firewall and network monitoring controls',
    total: 15,
    passed: 12,
    failed: 0,
    pending: 3,
  },
  {
    id: 'incident-response',
    name: 'Incident Response',
    description: 'Security incident detection and response',
    total: 12,
    passed: 8,
    failed: 2,
    pending: 2,
  },
  {
    id: 'vendor-management',
    name: 'Vendor Management',
    description: 'Third-party risk assessment controls',
    total: 10,
    passed: 7,
    failed: 1,
    pending: 2,
  },
  {
    id: 'business-continuity',
    name: 'Business Continuity',
    description: 'Disaster recovery and backup controls',
    total: 8,
    passed: 5,
    failed: 1,
    pending: 2,
  },
];

function ControlCard({ category }: { category: typeof controlCategories[0] }) {
  const passRate = Math.round((category.passed / category.total) * 100);

  return (
    <Card>
      <CardContent>
        <Stack gap="4">
          <Stack gap="1">
            <Text weight="semibold">{category.name}</Text>
            <Text variant="muted" size="sm">{category.description}</Text>
          </Stack>

          <Stack gap="2">
            <HStack justify="between" align="center">
              <Text size="sm" variant="muted">Progress</Text>
              <Text size="sm" weight="medium">{passRate}%</Text>
            </HStack>
            <Progress value={passRate} />
          </Stack>

          <HStack gap="4">
            <HStack gap="1" align="center">
              <CheckCircleIcon className="size-4 text-green-600" />
              <Text size="sm">{category.passed} passed</Text>
            </HStack>
            {category.failed > 0 && (
              <HStack gap="1" align="center">
                <CircleIcon className="size-4 text-red-500" />
                <Text size="sm">{category.failed} failed</Text>
              </HStack>
            )}
            {category.pending > 0 && (
              <HStack gap="1" align="center">
                <CircleIcon className="size-4 text-muted-foreground" />
                <Text size="sm" variant="muted">{category.pending} pending</Text>
              </HStack>
            )}
          </HStack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ControlsPage() {
  const totalControls = controlCategories.reduce((sum, c) => sum + c.total, 0);
  const passedControls = controlCategories.reduce((sum, c) => sum + c.passed, 0);

  return (
    <PageLayout padding="none" container={false}>
      <PageHeader title="Controls">
        <PageHeaderDescription>
          Monitor and manage your security controls across {totalControls} requirements.
        </PageHeaderDescription>
        <PageHeaderActions>
          <Button variant="outline" iconLeft={<FilterIcon />}>Filter</Button>
        </PageHeaderActions>
      </PageHeader>

      <Stack gap="4">
        <HStack gap="4">
          <Badge>{passedControls} of {totalControls} controls passing</Badge>
          <Badge variant="secondary">{Math.round((passedControls / totalControls) * 100)}% complete</Badge>
        </HStack>

        <Grid cols="3" gap="4">
          {controlCategories.map((category) => (
            <ControlCard key={category.id} category={category} />
          ))}
        </Grid>
      </Stack>
    </PageLayout>
  );
}
