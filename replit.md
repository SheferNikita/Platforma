# Обучающая платформа по трезвости

## Overview

A full-featured educational platform focused on sobriety with a Russian-language interface. It provides a public-facing section for students (lessons, library, schedule, communities) and a comprehensive admin panel for content and user management. Key features include Robokassa payment integration, automatic course enrollment post-payment, and customizable email notifications for different products. The project aims to provide a robust and user-friendly platform for sobriety education.

## User Preferences

- I prefer clear and concise communication.
- I expect the agent to prioritize critical tasks and system stability.
- All changes should be communicated and approved before implementation.
- I prefer detailed explanations for complex technical decisions.
- Do not make changes to the folder `prisma/`.
- Do not make changes to the file `server/src/index.ts`.

## System Architecture

The platform is built with a modern web stack. The frontend uses **React 18 with TypeScript**, **Vite** for fast builds, and **TailwindCSS 4.0** for styling. Navigation is handled by **React Router**, while **Recharts** is used for data visualization in the dashboard. **Lucide React** provides icons, and **Sonner** manages notifications.

The backend is powered by **Express.js (Node.js)**, utilizing **Prisma ORM 5.22.0** with a **PostgreSQL** database. **JWT** is implemented for authentication, and **Nodemailer** handles email services.

The project is structured into `prisma/` (schema, seed), `server/` (entry point, middleware, routes, services), and `src/` (admin panel, shared components, utilities, public pages).

**Key Features and Design Decisions:**

-   **Admin Panel:** Comprehensive control over content, users, finances, and emails.
    -   **Dashboard:** Displays key metrics, revenue graphs, and recent payments.
    -   **Content Management:** CRUD operations for lessons (with drafts), library materials, schedule events, contacts, communities, and mini-groups.
    -   **User Management:** Student and administrator management with role-based access control.
    -   **Financials:** Product creation with pricing and email templates, payment CRM with history and statuses.
    -   **Email System:** Individual and mass email sending with customizable templates.
    -   **Rich Text Editor:** Lessons support rich text content via TipTap, Kinescope video integration, and file attachments.
    -   **Content Reordering:** Manual reordering functionality for modules, lessons, library items, and contacts.
-   **User Roles:** Granular access control with roles: `SUPER_ADMIN`, `ADMIN`, `CURATOR`, `MENTOR`, `MODERATOR`, and `STUDENT`.
    -   `SUPER_ADMIN`: Full access to all sections including audit logs and admin management
    -   `ADMIN`: Full access to all sections except audit logs; cannot create/edit/delete super-admins
    -   `CURATOR`: Access to students, distribution, and moderation
    -   `MENTOR`, `MODERATOR`: Access to moderation only
-   **Module Access Control:** System for managing student access to specific modules, including expiration dates.
-   **Mini-Groups:** Enhanced management of mini-groups, including curator assignment, chat links, and dedicated scheduling within group settings.
-   **Authentication:** Dual mechanism supporting both HttpOnly cookies (`sameSite: 'none'`, `secure: true`) and a fallback to `localStorage` with `Authorization` headers for iframe compatibility.
-   **UI/UX:** The admin panel features a warm, beige color scheme, rounded corners, and a glassmorphism effect, aligning with the platform's overall aesthetic.
-   **Mobile Responsiveness:** The admin panel is fully responsive for mobile devices:
    -   Hamburger menu with slide-out navigation sidebar on mobile (lg: breakpoint)
    -   Tables converted to card views on mobile (md:hidden for cards, hidden md:block for tables)
    -   Modals are full-screen and scrollable on mobile (max-h-[90vh] overflow-y-auto)
    -   Responsive grids (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3)
    -   Tailwind responsive prefixes preserve desktop layouts unchanged

## External Dependencies

-   **PostgreSQL:** Primary database managed by Prisma ORM.
-   **Robokassa:** Payment gateway integrated for processing payments.
    -   Endpoints: `POST /api/payments/result`, `GET /api/payments/success`, `GET /api/payments/fail`.
    -   Automated enrollment and email notification upon successful payment.
-   **Kinescope:** Video hosting service integrated for lesson content.