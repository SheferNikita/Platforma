import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { LibraryTab } from '../components/LibraryTab';
import { SectionGuard } from '../components/SectionGuard';

export function LibraryPage() {
  return (
    <PageWrapper>
      <SectionGuard section="library">
        <LibraryTab />
      </SectionGuard>
    </PageWrapper>
  );
}
