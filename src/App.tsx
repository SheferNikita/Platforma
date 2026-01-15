import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LessonsPage } from './pages/LessonsPage';
import { LessonDetailPage } from './pages/LessonDetailPage';
import { ChatsPage } from './pages/ChatsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SchedulePage } from './pages/SchedulePage';
import { ContactsPage } from './pages/ContactsPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { ProfilePage } from './pages/ProfilePage';
import { SOSPage } from './pages/SOSPage';
import { MyDiariesPage } from './pages/MyDiariesPage';
import { MyNotesPage } from './pages/MyNotesPage';
import { MiniGroupPage } from './pages/MiniGroupPage';
import { AuthProvider, useAuth } from './lib/auth';
import { AdminLayout } from './admin/components/AdminLayout';
import { AdminLogin } from './admin/pages/AdminLogin';
import { Dashboard } from './admin/pages/Dashboard';
import { LessonsAdmin } from './admin/pages/LessonsAdmin';
import { LibraryAdmin } from './admin/pages/LibraryAdmin';
import { ScheduleAdmin } from './admin/pages/ScheduleAdmin';
import { ContactsAdmin } from './admin/pages/ContactsAdmin';
import { CommunitiesAdmin } from './admin/pages/CommunitiesAdmin';
import { MiniGroupsAdmin } from './admin/pages/MiniGroupsAdmin';
import { StudentsAdmin } from './admin/pages/StudentsAdmin';
import { ProductsAdmin } from './admin/pages/ProductsAdmin';
import { PaymentsAdmin } from './admin/pages/PaymentsAdmin';
import { EmailAdmin } from './admin/pages/EmailAdmin';
import { AdminsAdmin } from './admin/pages/AdminsAdmin';
import { CRMAdmin } from './admin/pages/CRMAdmin';
import { ModerationAdmin } from './admin/pages/ModerationAdmin';
import { PaymentPage } from './pages/PaymentPage';
import { Toaster } from 'sonner';

function LessonsRedirect() {
  const { lessonId } = useParams();
  return <Navigate to={`/lesson/${lessonId}`} replace />;
}

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f3ed] via-[#ebe8dc] to-[#f0ede3]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/sos" element={<SOSPage />} />
          <Route path="/pay/:productId" element={<PaymentPage />} />
          
          <Route path="/admin/login" element={<AdminLogin />} />
          
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="lessons" element={<LessonsAdmin />} />
            <Route path="library" element={<LibraryAdmin />} />
            <Route path="schedule" element={<ScheduleAdmin />} />
            <Route path="contacts" element={<ContactsAdmin />} />
            <Route path="communities" element={<CommunitiesAdmin />} />
            <Route path="mini-groups" element={<MiniGroupsAdmin />} />
            <Route path="students" element={<StudentsAdmin />} />
            <Route path="moderation" element={<ModerationAdmin />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="crm" element={<CRMAdmin />} />
            <Route path="payments" element={<PaymentsAdmin />} />
            <Route path="email" element={<EmailAdmin />} />
            <Route path="admins" element={<AdminsAdmin />} />
          </Route>
          
          <Route path="/" element={<Layout />}>
            <Route index element={<LessonsPage />} />
            <Route path="lesson/:lessonId" element={<LessonDetailPage />} />
            <Route path="lessons/:lessonId" element={<LessonsRedirect />} />
            <Route path="chats" element={<ChatsPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="communities" element={<CommunitiesPage />} />
            <Route path="mini-group" element={<MiniGroupPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="my-diaries" element={<MyDiariesPage />} />
            <Route path="my-notes" element={<MyNotesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
