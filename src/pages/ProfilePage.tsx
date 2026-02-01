import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { ProfileTab } from '../components/ProfileTab';
import { SectionGuard } from '../components/SectionGuard';

export function ProfilePage() {
  return (
    <PageWrapper>
      <SectionGuard section="profile">
        <ProfileTab />
      </SectionGuard>
    </PageWrapper>
  );
}
