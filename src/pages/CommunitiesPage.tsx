import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { CommunitiesTab } from '../components/CommunitiesTab';
import { SectionGuard } from '../components/SectionGuard';

export function CommunitiesPage() {
  return (
    <PageWrapper>
      <SectionGuard section="communities">
        <CommunitiesTab />
      </SectionGuard>
    </PageWrapper>
  );
}
