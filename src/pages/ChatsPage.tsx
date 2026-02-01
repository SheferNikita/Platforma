import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { ChatsTab } from '../components/ChatsTab';
import { SectionGuard } from '../components/SectionGuard';

export function ChatsPage() {
  return (
    <PageWrapper>
      <SectionGuard section="chats">
        <ChatsTab />
      </SectionGuard>
    </PageWrapper>
  );
}
