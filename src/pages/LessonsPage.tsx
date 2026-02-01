import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { LessonsTab } from '../components/LessonsTab';
import { SectionGuard } from '../components/SectionGuard';

export function LessonsPage() {
  return (
    <PageWrapper>
      <SectionGuard section="lessons">
        <LessonsTab />
      </SectionGuard>
    </PageWrapper>
  );
}
