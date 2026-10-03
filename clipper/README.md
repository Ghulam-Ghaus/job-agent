# JobAgent AI — Browser Clipper Extension

Clip job postings, freelance projects, and direct client leads into your JobAgent AI scoring pipeline with one click.

## How to Install in Chrome / Edge / Brave

1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked**.
4. Select this directory: `D:\PL\job-agent\clipper`.
5. The **JobAgent AI Clipper** icon will now appear in your browser extension toolbar.

## How to Use

1. Navigate to any job post (LinkedIn, Indeed, GulfTalent, Bayt, etc.).
2. Either highlight the job description or simply click the **JobAgent AI** extension icon.
3. Select the type (`Job Opening`, `Freelance Project`, or `Direct Client Lead`).
4. Click **Send to JobAgent AI**.
5. The posting is immediately sent to `http://localhost:4000/api/v1/opportunities` for AI extraction and code scoring!
