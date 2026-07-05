# Walkthrough - Google Sheets Integration & Web Deployment

This document provides a guide on how to configure your manpower control dashboard to pull data dynamically from a **Google Sheet** and how to **deploy the site to the web** for free.

---

## 1. How to Link Your Google Sheet

The dashboard is designed to fetch data directly from a published Google Sheet in real-time. If no Google Sheet ID is entered, it gracefully falls back to the static demo data.

### Step 1: Upload the Excel File to Google Drive
1. Go to [Google Drive](https://drive.google.com/) and upload `LR9 ตารางควบคุม DC หมวด A-D.xlsx`.
2. Open the uploaded file and select **File > Save as Google Sheets** (if it opens as an `.xlsx` preview).

### Step 2: Publish Your Google Sheet to the Web
1. Open the Google Sheet.
2. Select **File (ไฟล์) > Share (แชร์) > Publish to Web (เผยแพร่ไปยังเว็บ)**.
3. Keep the settings as **Entire Document** and **Web Page**. Click **Publish (เผยแพร่)** and confirm.
   *(Note: This makes the spreadsheet data readable via a public link, but only to those who know the Spreadsheet ID. No login is required by the React app).*

### Step 3: Copy the Spreadsheet ID
1. In your browser's address bar, look at the URL of your Google Sheet.
2. Copy the long code between `/d/` and `/edit`.
   * *Example:* For `https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J/edit#gid=0`, the ID is `1A2B3C4D5E6F7G8H9I0J`.

### Step 4: Link It in the Dashboard
1. Open the dashboard (e.g. `http://localhost:5173/`).
2. Click the **Gear icon (Settings)** at the top right header.
3. Paste your **Spreadsheet ID** into the input field and click **ซิงค์ข้อมูล (Sync)**.
4. The dashboard will instantly fetch, parse, and render your live Google Sheets data. It will save this ID in your browser's `localStorage` so it stays synced even if you refresh the page.

---

## 2. Web Deployment Guides

Choose one of the following two free methods to deploy your dashboard webapp to the web.

### Method A: Vercel Deployment (Recommended - Easiest)

Vercel provides zero-configuration hosting for static web apps.

1. **Install Vercel CLI globally (or run via npx)**:
   Open a terminal inside your project's `webapp` directory (`d:/Sandbox/DC/webapp`) and run:
   ```bash
   npx vercel
   ```
2. **Follow the CLI Prompts**:
   - *Set up and deploy?* Yes (y)
   - *Which scope?* (Select your Vercel account)
   - *Link to existing project?* No (n)
   - *What's your project's name?* `manpower-control-dashboard` (or choose any name)
   - *In which directory is your code located?* `./`
   - *Want to modify settings?* No (n)
3. **Deployment Complete**:
   Vercel will bundle your app and print a live URL (e.g., `https://manpower-control-dashboard.vercel.app/`). Anyone can access it. To update it in the future, simply run `npx vercel --prod` again in the `webapp` folder.

---

### Method B: GitHub Pages Deployment

If your code is hosted in a public/private GitHub repository:

1. **Install `gh-pages` dependency**:
   In `d:/Sandbox/DC/webapp`, run:
   ```bash
   npm.cmd install gh-pages --save-dev
   ```
2. **Configure Vite Base Path**:
   Open `webapp/vite.config.js` and add the `base` property:
   ```javascript
   export default defineConfig({
     base: '/repository-name/', // Replace with your exact GitHub repository name
     plugins: [react()],
   })
   ```
3. **Add Deploy Scripts to `package.json`**:
   Open `webapp/package.json` and add these two scripts under `"scripts"`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
4. **Deploy**:
   Run:
   ```bash
   npm.cmd run deploy
   ```
   This will automatically compile your project and upload the built assets to a `gh-pages` branch on GitHub. Your site will be live at `https://<your-username>.github.io/<repository-name>/`.
