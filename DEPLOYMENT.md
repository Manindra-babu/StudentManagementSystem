# Academix Student Management System (SMS) - Production Deployment Guide

This application is fully production-ready. It includes full database modeling, Express backend API, Socket.io real-time updates, PDF document generation, and a React (Vite) single-page application (SPA).

---

## 🚀 Option 1: Deploy to Render.com (Recommended Free Cloud Hosting)

Render provides free hosting for web services. A pre-configured [`render.yaml`](file:///c:/Users/manin/OneDrive/Desktop/Student%20Management%20system/render.yaml) is included in the project.

### Steps:
1. Push this workspace code to a **GitHub / GitLab** repository.
2. Log into [Render.com](https://render.com).
3. Click **New +** → Select **Blueprint**.
4. Connect your GitHub repository. Render will automatically detect `render.yaml` and configure the web service.
5. Click **Apply**.
6. Render will automatically execute `npm install && npm run db:setup && npm run build` and launch the web service at `https://your-app.onrender.com`.

---

## 🌩️ Option 2: Deploy using Docker (Container Hosting)

A production-optimized multi-stage [`Dockerfile`](file:///c:/Users/manin/OneDrive/Desktop/Student%20Management%20system/Dockerfile) is included.

### Steps:
1. Build the Docker image:
   ```bash
   docker build -t academix-sms .
   ```
2. Run the container:
   ```bash
   docker run -d -p 5000:5000 --name academix academix-sms
   ```
3. Access the web app at `http://localhost:5000`.

---

## 🚄 Option 3: Deploy to Railway.app

1. Log into [Railway.app](https://railway.app).
2. Click **New Project** → **Deploy from GitHub Repo**.
3. Select your repository.
4. Set Environment Variables:
   - `PORT=5000`
   - `NODE_ENV=production`
   - `JWT_SECRET=your-secret-key`
5. Railway will run `npm run build` and `npm start` automatically.

---

## 💻 Option 4: Deploy to VPS / Self-Hosted Server (Ubuntu / Nginx)

1. Clone your repo onto your server.
2. Install Node.js v20+ and npm.
3. Install dependencies and initialize database:
   ```bash
   npm install
   npm run db:setup
   npm run build
   ```
4. Start process using PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "academix-sms" -- start
   pm2 save
   ```

---

## 🔑 Pre-seeded Production Login Credentials

Once deployed, use the following credentials to access each portal:

| Portal | Role | Email | Password |
|---|---|---|---|
| Admin Portal | Admin | `admin@academix.edu` | `password123` |
| Lecturer Portal | Lecturer | `sarah.connor@academix.edu` | `password123` |
| Lecturer Portal | Lecturer | `alan.turing@academix.edu` | `password123` |
| Student Portal | Student | `emily.smith@academix.edu` | `password123` |
| Student Portal | Student | `jacob.johnson@academix.edu` | `password123` |
