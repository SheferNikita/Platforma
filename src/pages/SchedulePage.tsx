import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { ScheduleTab } from '../components/ScheduleTab';
import { SectionGuard } from '../components/SectionGuard';

export function SchedulePage() {
  return (
    <PageWrapper>
      <SectionGuard section="schedule">
        <ScheduleTab />
      </SectionGuard>
    </PageWrapper>
  );
}
