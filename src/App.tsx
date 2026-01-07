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

function LessonsRedirect() {
  const { lessonId } = useParams();
  return <Navigate to={`/lesson/${lessonId}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* SOS page without Layout */}
        <Route path="/sos" element={<SOSPage />} />
        
        {/* Regular pages with Layout */}
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
    </BrowserRouter>
  );
}