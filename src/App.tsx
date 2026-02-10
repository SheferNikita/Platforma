import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './lib/auth';
import { SettingsProvider, useSettings } from './lib/settings';
import { Toaster } from 'sonner';

const LessonsPage = lazy(() => import('./pages/LessonsPage').then(m => ({ default: m.LessonsPage })));
const LessonDetailPage = lazy(() => import('./pages/LessonDetailPage').then(m => ({ default: m.LessonDetailPage })));
const ChatsPage = lazy(() => import('./pages/ChatsPage').then(m => ({ default: m.ChatsPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then(m => ({ default: m.LibraryPage })));
const SchedulePage = lazy(() => import('./pages/SchedulePage').then(m => ({ default: m.SchedulePage })));
const ContactsPage = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })));
const CommunitiesPage = lazy(() => import('./pages/CommunitiesPage').then(m => ({ default: m.CommunitiesPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SOSPage = lazy(() => import('./pages/SOSPage').then(m => ({ default: m.SOSPage })));
const MyDiariesPage = lazy(() => import('./pages/MyDiariesPage').then(m => ({ default: m.MyDiariesPage })));
const MyNotesPage = lazy(() => import('./pages/MyNotesPage').then(m => ({ default: m.MyNotesPage })));
const MentorResponsesPage = lazy(() => import('./pages/MentorResponsesPage').then(m => ({ default: m.MentorResponsesPage })));
const MiniGroupPage = lazy(() => import('./pages/MiniGroupPage').then(m => ({ default: m.MiniGroupPage })));
const OnboardingSurvey = lazy(() => import('./pages/OnboardingSurvey').then(m => ({ default: m.OnboardingSurvey })));
const PaymentPage = lazy(() => import('./pages/PaymentPage').then(m => ({ default: m.PaymentPage })));

const AdminLayout = lazy(() => import('./admin/components/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminLogin = lazy(() => import('./admin/pages/AdminLogin').then(m => ({ default: m.AdminLogin })));
const LessonsAdmin = lazy(() => import('./admin/pages/LessonsAdmin').then(m => ({ default: m.LessonsAdmin })));
const LibraryAdmin = lazy(() => import('./admin/pages/LibraryAdmin').then(m => ({ default: m.LibraryAdmin })));
const ScheduleAdmin = lazy(() => import('./admin/pages/ScheduleAdmin').then(m => ({ default: m.ScheduleAdmin })));
const ContactsAdmin = lazy(() => import('./admin/pages/ContactsAdmin').then(m => ({ default: m.ContactsAdmin })));
const CommunitiesAdmin = lazy(() => import('./admin/pages/CommunitiesAdmin').then(m => ({ default: m.CommunitiesAdmin })));
const ChatsAdmin = lazy(() => import('./admin/pages/ChatsAdmin').then(m => ({ default: m.ChatsAdmin })));
const MiniGroupsAdmin = lazy(() => import('./admin/pages/MiniGroupsAdmin').then(m => ({ default: m.MiniGroupsAdmin })));
const StudentsAdmin = lazy(() => import('./admin/pages/StudentsAdmin').then(m => ({ default: m.StudentsAdmin })));
const ProductsAdmin = lazy(() => import('./admin/pages/ProductsAdmin').then(m => ({ default: m.ProductsAdmin })));
const PaymentsAdmin = lazy(() => import('./admin/pages/PaymentsAdmin').then(m => ({ default: m.PaymentsAdmin })));
const EmailAdmin = lazy(() => import('./admin/pages/EmailAdmin').then(m => ({ default: m.EmailAdmin })));
const AdminsAdmin = lazy(() => import('./admin/pages/AdminsAdmin').then(m => ({ default: m.AdminsAdmin })));
const CRMAdmin = lazy(() => import('./admin/pages/CRMAdmin').then(m => ({ default: m.CRMAdmin })));
const ModerationAdmin = lazy(() => import('./admin/pages/ModerationAdmin').then(m => ({ default: m.ModerationAdmin })));
const AuditLogAdmin = lazy(() => import('./admin/pages/AuditLogAdmin').then(m => ({ default: m.AuditLogAdmin })));
const DistributionAdmin = lazy(() => import('./admin/pages/DistributionAdmin').then(m => ({ default: m.DistributionAdmin })));
const SettingsAdmin = lazy(() => import('./admin/pages/SettingsAdmin').then(m => ({ default: m.SettingsAdmin })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fdfbf7] via-[#e3ebf1] to-[#f5f3ed]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--button-lavender)]"></div>
    </div>
  );
}

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

function ProtectedStudentRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fdfbf7] via-[#e3ebf1] to-[#f5f3ed]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--button-lavender)]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const noSurveyTariffs = ['BASIC', 'FAMILY', 'RELATIVE'];
  if (user.role === 'STUDENT' && !user.surveyCompleted && !noSurveyTariffs.includes(user.tariff || '')) {
    return <Navigate to="/survey" replace />;
  }

  return <>{children}</>;
}

function DynamicHead() {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings.platformName) {
      document.title = settings.platformName;
    }
  }, [settings.platformName]);

  useEffect(() => {
    if (settings.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.favicon;
    }
  }, [settings.favicon]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
        <DynamicHead />
        <Toaster position="top-right" richColors />
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/sos" element={<SOSPage />} />
          <Route path="/pay/:productId" element={<PaymentPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/survey" element={<OnboardingSurvey />} />
          
          <Route path="/admin/login" element={<AdminLogin />} />
          
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<Navigate to="/admin/lessons" replace />} />
            <Route path="lessons" element={<LessonsAdmin />} />
            <Route path="library" element={<LibraryAdmin />} />
            <Route path="schedule" element={<ScheduleAdmin />} />
            <Route path="contacts" element={<ContactsAdmin />} />
            <Route path="communities" element={<CommunitiesAdmin />} />
            <Route path="chats" element={<ChatsAdmin />} />
            <Route path="mini-groups" element={<MiniGroupsAdmin />} />
            <Route path="students" element={<StudentsAdmin />} />
            <Route path="moderation" element={<ModerationAdmin />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="crm" element={<CRMAdmin />} />
            <Route path="payments" element={<PaymentsAdmin />} />
            <Route path="email" element={<EmailAdmin />} />
            <Route path="admins" element={<AdminsAdmin />} />
            <Route path="audit" element={<AuditLogAdmin />} />
            <Route path="distribution" element={<DistributionAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
          </Route>
          
          <Route
            path="/"
            element={
              <ProtectedStudentRoute>
                <Layout />
              </ProtectedStudentRoute>
            }
          >
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
            <Route path="mentor-responses" element={<MentorResponsesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
