import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { ContactsTab } from '../components/ContactsTab';
import { SectionGuard } from '../components/SectionGuard';

export function ContactsPage() {
  return (
    <PageWrapper>
      <SectionGuard section="contacts">
        <ContactsTab />
      </SectionGuard>
    </PageWrapper>
  );
}
