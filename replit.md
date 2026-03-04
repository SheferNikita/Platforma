# Обучающая платформа по трезвости

## Overview

A full-featured educational platform focused on sobriety with a Russian-language interface. It provides a public-facing section for students (lessons, library, schedule, communities) and a comprehensive admin panel for content and user management. Key features include Robokassa payment integration, automatic course enrollment post-payment, and customizable email notifications for different products. The project aims to provide a robust and user-friendly platform for sobriety education.

## User Preferences

- Always communicate in Russian language.
- I prefer clear and concise communication.
- I expect the agent to prioritize critical tasks and system stability.
- All changes should be communicated and approved before implementation.
- I prefer detailed explanations for complex technical decisions.
- Do not make changes to the folder `prisma/`.
- Do not make changes to the file `server/src/index.ts`.

## System Architecture

The platform is built with a modern web stack. The frontend uses **React 18 with TypeScript**, **Vite** for fast builds, and **TailwindCSS 4.0** for styling. Navigation is handled by **React Router**, while **Recharts** is used for data visualization in the dashboard. **Lucide React** provides icons, and **Sonner** manages notifications.

The backend is powered by **Express.js (Node.js)**, utilizing **Prisma ORM 5.22.0** with a **PostgreSQL** database. **JWT** is implemented for authentication, and **Nodemailer** handles email services.

**Key Features and Design Decisions:**

-   **Admin Panel:** Comprehensive control over content, users, financials, and emails. Features include:
    -   Dashboard for key metrics.
    -   CRUD for lessons (with drafts), library, schedule, contacts, communities, mini-groups.
    -   User management with role-based access control (SUPER_ADMIN, ADMIN, CURATOR, MENTOR, PSYCHOLOGIST, INTERN, MODERATOR, ADMIN_ASSISTANT, STUDENT).
    -   Product creation, payment CRM, and email system with customizable and scheduled templates.
    -   Rich Text Editor for lessons (TipTap, Kinescope, file attachments).
    -   Diary and Notes Attachments stored as base64 in the database.
    -   Scheduled Lesson Publishing with `publishedAt` tracking and Content Reordering.
    -   In-App Notification System for real-time alerts.
-   **Student Tariff System:** Six-tier access control (`BASIC`, `FAMILY`, `RELATIVE`, `WITH_MENTOR`, `WITH_PSYCHOLOGIST`, `INDIVIDUAL_PSYCHOLOGIST`) affecting feature access.
-   **Prepayment Tracking System:** Products and students can be marked with a prepayment status using specific naming conventions and tags in notes.
-   **Module Access Control:** System for managing student access to specific modules with expiration dates.
-   **Communities:** Tariff-based visibility (`allowedTariffs` TEXT[]) and short description (`shortDescription` TEXT) per community. Empty tariffs array = visible to all. Separate visibility toggles for "Очные" and "Онлайн" tabs (`communities_offline_visible`, `communities_online_visible` settings). Multiple leaders per community (`leaders` TEXT as JSON array of `[{name, contact}]`), customizable button labels (`contactButtonLabel`, `joinButtonLabel`). Russian-localized community type labels (`mixed`→Смешанная, `dependent`→Для зависимых, `codependent`→Для созависимых).
-   **Mini-Groups:** Enhanced management including curator assignment and chat links.
-   **Authentication:** Dual mechanism using HttpOnly cookies and `localStorage` fallback for iframe compatibility. All `localStorage` access is wrapped in try-catch (via `src/lib/safeStorage.ts`) to prevent Safari WebView crashes in Telegram/Instagram/VK In-App Browsers.
-   **UI/UX:** Warm, beige color scheme with rounded corners and glassmorphism effect.
-   **Mobile Responsiveness:** Fully responsive design for the admin panel, adapting tables to cards, full-screen modals, and responsive grids.
-   **Platform Settings System:** Centralized configuration management for general settings, SOS features, section visibility, and email templates, with history tracking and rollback.
-   **Audit Logging & Rollback System:** Tracks all CREATE, UPDATE, DELETE operations with before/after snapshots for entities, allowing rollback functionality.

**Notification System:**
-   Tariff-based filtering: schedule events and library items with `allowedTariffs` only notify students with matching tariffs. Empty tariffs = notify all.
-   Lesson notifications: sent on both scheduled publishing (`scheduledPublish.ts`) and manual publishing (PUT /lessons/:id). Both use `ModuleAccess` to filter recipients. Manual publish also sends email via `emailTemplateService`.
-   All notification sends are fire-and-forget (after response) to avoid blocking the admin UI.

**Performance Optimizations:**
-   Server-side compression (gzip), static asset caching, and code splitting for faster load times.
-   In-memory server cache for modules/lessons.
-   Combined API endpoints and deduplicated API calls.
-   Mobile-specific optimizations for lesson pages (collapsible sections, deferred data loading, simplified CSS, hidden nav buttons, skipped `/public/modules` API call).
-   AdminLog writes and notification sends moved to background (fire-and-forget) for schedule and library endpoints.

The project is structured into `prisma/` (schema, seed), `server/` (entry point, middleware, routes, services), and `src/` (admin panel, shared components, utilities, public pages).

## External Dependencies

-   **PostgreSQL (TimeWeb.cloud):** External database for production data persistence.
-   **Robokassa:** Payment gateway for processing payments, including automated enrollment and notifications.
-   **Tilda:** Landing page integration for payment webhooks, user account creation, module access granting, and welcome emails.
-   **Kinescope:** Video hosting service for lesson content.