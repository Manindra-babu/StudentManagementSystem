# Academix - Next-Generation Student Management System (SMS)

Academix is a modern, high-performance, and feature-rich Student Management System. Built from the ground up, it offers a unified codebase with distinct, highly responsive portals for Admins, Lecturers, and Students, complete with role-based access control (RBAC).

## Standout Feature: Real-Time QR Code Attendance
* **Time-Limited QR Session**: Instructors can spin up an attendance session for a class section specifying active minutes (e.g. 10 mins). A dynamic token-based QR Code is generated with live expiry feedback.
* **Instant Check-in Sync**: Logged-in students can scan the QR code (or enter the generated code using our desktop simulator) to check in.
* **WebSocket Roster Feed**: When a student checks in, Socket.io pushes a message to the lecturer's console, appending the student's details and incrementing the live attendance count immediately without page refreshes.
* **Manual Override & Override logs**: Instructors can manually override rosters (Absent/Present/Late/Excused) before finalizing. Finalization automatically markers any unmarked student as absent.

---

## Tech Stack
* **Frontend**: React (Vite) + TypeScript, Tailwind CSS, Lucide icons, Recharts dashboards.
* **Backend**: Node.js + Express, TypeScript, SQLite database (Prisma ORM connector, easily switchable to PostgreSQL), Socket.io websockets.
* **Reports**: Server-side PDF generation for receipts and report cards.

---

## Workspace Structure
```
/student-management-system
├── backend/            # Express REST server, Websocket handler & Prisma migrations
│   ├── src/
│   │   ├── controllers/      # Route logic
│   │   ├── middleware/       # JWT Auth guard
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # PDF receipt/report builders
│   │   └── index.ts          # Main Express + Socket.io launcher
│   └── prisma/
│       ├── schema.prisma     # SQLite DB definition
│       └── seed.ts           # Seeding script
├── frontend/           # React single-page app (Vite)
│   ├── src/
│   │   ├── contexts/         # Auth & Socket persistence
│   │   ├── pages/            # Login, Admin, Lecturer, & Student portals
│   │   └── App.tsx           # Dynamic Portal router
│   └── tailwind.config.js    # Design palette
```

---

## Installation & Startup

### 1. Install Workspace Dependencies
Ensure you have Node.js (v18+) and npm installed. Run the following command in the project root:
```bash
npm install
```

### 2. Set Up Database Schema & Seed Data
Generate Prisma client, apply database schema migrations, and seed sample student records:
```bash
# From the root directory:
npm run prisma:migrate
npm run prisma:seed
```
*This configures a zero-setup local SQLite database `dev.db` in the `backend/prisma/` directory.*

### 3. Run Development Servers
Start both the backend server (on `http://localhost:5000`) and Vite frontend dev server (on `http://localhost:5173`) concurrently:
```bash
npm run dev
```

---

## Pre-Seeded Test Credentials

To test each portal immediately, log in using any of the following pre-seeded credentials. **Password for all accounts: `password123`**

| Portal Role | Sample Login Email | Mock Profile Identity |
| :--- | :--- | :--- |
| **System Admin** | `admin@academix.edu` | System Administrator |
| **Instructor** | `sarah.connor@academix.edu` | Dr. Sarah Connor (CSE Faculty) |
| **Instructor** | `alan.turing@academix.edu` | Dr. Alan Turing (CSE Faculty) |
| **Student** | `emily.smith@academix.edu` | Emily Smith (Roll: `CS2026001`) |
| **Student** | `jacob.johnson@academix.edu` | Jacob Johnson (Roll: `CS2026002`) |

---

## Verification Guide (End-to-End Live Check-in)

1. Open two separate browser tabs or windows:
   * **Window 1 (Lecturer)**: Go to `http://localhost:5173`, click **Lecturer** quick-login, and log in.
   * **Window 2 (Student)**: Go to `http://localhost:5173` (incognito/different browser recommended to prevent session sharing, or run separately), click **Student** quick-login, and log in as `emily.smith@academix.edu`.
2. **Lecturer Portal**:
   * Navigate to the **QR Check-in Console** tab.
   * Select a class section (e.g. *Introduction to Programming*) and click **Generate Live QR Code**.
   * A QR code will display alongside a verification text code (e.g. `ABC123-4567`).
3. **Student Portal**:
   * Navigate to the **QR Class Check-in** tab.
   * Copy the verification text code from the Lecturer's window, paste it into the **Enter QR Code Contents** field in the simulator scanner, and click **Submit Check-in**.
4. **Immediate Feedback**:
   * Look back at the Lecturer's console. You will see the present count update and *Emily Smith* immediately appended to the roster list in real time without refreshing the page!
