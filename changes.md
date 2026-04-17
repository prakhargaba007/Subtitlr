# Dubbing Studio Website Review

**URL:** [https://dubbingstudio.prakhargaba.com/](https://dubbingstudio.prakhargaba.com/)  
**Date:** April 16, 2026  
**Scope:** Full A-to-Z audit of buttons, links, menus, color scheme, content, and UX

---

## 1. DEAD LINKS (href="#" - Lead Nowhere)

These links exist in the navigation or footer but point to `#`, meaning they do absolutely nothing when clicked:

### Navigation Bar (appears on every page)

- **"Use Cases"** nav link → `href="#"` — goes nowhere 
- **✅ "Docs"** nav link → `href="#"` — goes nowhere - comming soon
- **"Product"** nav link → `href="/"` — just reloads the homepage instead of going to a dedicated Product page

### Footer (appears on every page)

- **✅"Privacy Policy"** → `href="#"` — dead link, no actual privacy policy page
- **✅"Terms of Service"** → `href="#"` — dead link, no actual terms page
- **✅"Help Center"** → `href="#"` — dead link, no help center exists
- **"API Status"** → `href="#"` — dead link, no status page exists
- **"Twitter"** → `href="#"` — dead link, does not go to any Twitter/X profile
- **✅"GitHub"** → `href="#"` — dead link, does not go to any GitHub repository

> **Impact:** 8 out of 10 footer/nav links are completely non-functional. This is a major trust issue for any visitor.

---

## 2. BUTTONS THAT DO NOTHING

### Homepage

- **✅ "Start Free Trial"** button (CTA in the purple banner at page bottom) — does nothing on click. No navigation, no modal, no action.
- **"View All Features"** button (CTA in the purple banner at page bottom) — does nothing on click. No navigation, no action.
- **✅ "No video? Try a sample file"** button — does nothing on click. Should load a demo sample file but has no functionality.
- **"View Presets"** button (in the "Reels & TikTok Ready" section) — does nothing on click.
- **✅ "Start Dubbing"** button (on homepage uploader) — shows "Select a file to get started" text but has no error feedback, tooltip, or visual indication when clicked without a file.

### Pricing Page

- **✅ "Start free"** button (Free plan) — redirects to dashboard, which is fine, but inconsistent with Premium/Pro buttons.
- **✅ "Get started"** button (Premium plan) — redirects to dashboard but does not initiate any plan selection or checkout flow.
- **✅ "Get started"** button (Pro plan) — same issue, just goes to dashboard with no plan context.

### Dashboard Sidebar

- **"Projects"** sidebar link → `href="#"` — dead link
- **"AI Tools"** sidebar link → `href="#"` — dead link
- **"All Projects"** sidebar link → `href="#"` — dead link
- **"Credit History"** sidebar link → `href="#"` — dead link
- **"Documentation"** sidebar link → `href="#"` — dead link

> **Impact:** The dashboard sidebar has 5 out of 7 links that are non-functional. The app feels like a shell.

---

## 3. CONTENT & COPY ISSUES

- **Hero headline vs. subtitle mismatch** — The headline says "Turn Video & Audio into **Dubs** in Seconds" but the subtitle says "Upload a video, get accurate **SRT/VTT captions** in 60+ languages." The headline is about dubbing; the subtitle is about captions/subtitles. These are different features and the messaging is contradictory.
- **Page title mismatch** — The browser tab says "The Intelligent Canvas for **Transcription**" but the product is branded as a dubbing studio. The title, headline, and subtitle all describe different products.
- **Meta description mismatch** — Says "High-precision transcription meets editorial elegance. Turn video & audio into subtitles in seconds." Again references transcription/subtitles, not dubbing.
- **Dashboard greeting uses hardcoded name** — Says "Good morning, **Alex**" but the logged-in user is "harshjorwal2006." The greeting is not personalized and uses a placeholder name.
- **"Billing runs through Dodo"** — The pricing page references "Dodo" as the payment processor. This is an obscure reference that most users won't recognize. No link to explain what Dodo is.
- **"V2.0 NOW LIVE" badge** — This announcement badge has no link, no changelog, and no way to learn what's new in V2.0. It's a decorative dead-end.
- **FAQ section heading inconsistency** — Homepage FAQ says "Frequently Asked Questions" while Pricing page FAQ says just "FAQ." The styling and subtitle text also differ between pages.

---

## 4. BRAND LOGOS / TRUST SECTION ISSUES

- **Fake client logos** — The section says "BUILT FOR CREATORS ON YOUTUBE, TIKTOK, AND REELS" but displays logos of Microsoft, Spotify, IBM, Google, and Nike. These are Fortune 500 companies, not content creators. There's no indication these companies actually use the product.
- **Logos are hotlinked from Wikipedia** — All brand images are loaded directly from `upload.wikimedia.org`. This is unreliable (Wikipedia can block hotlinking), unprofessional, and potentially violates Wikipedia's usage terms.
- **Logo links go to company homepages** — Clicking the Microsoft logo goes to microsoft.com, Nike logo to nike.com, etc. These links serve no purpose and confuse users by navigating them away from the site.
- **Logo section text mismatch** — Says "Built for creators" but shows enterprise company logos, not creator brands or testimonials.

---

## 5. COLOR SCHEME & VISUAL DESIGN ISSUES

- **Inconsistent button styling** — The "Get started" button on Premium (filled purple) looks different from "Get started" on Pro (outlined). The Free plan button says "Start free" instead of "Get started." Three different treatments for the same action across three pricing cards.
- **Purple/indigo overuse without hierarchy** — Nearly everything interactive is the same shade of purple/indigo (#4F46E5 or similar): nav active state, CTA buttons, heading accents, toggle switches, credit bar, links, checkmarks. There's no visual hierarchy to distinguish primary from secondary actions.
- **Low contrast on footer text** — Footer links (Privacy Policy, Terms, etc.) use a muted gray color on a slightly off-white background. Readability suffers.
- **"EDITORIAL PRECISION" label** — Uses a red/coral accent color that appears only once on the entire site, creating visual inconsistency.
- **The "Dubbing" toggle active state** — Uses a subtle outlined style that doesn't clearly communicate it's the selected/active tab versus the "Subtitles" tab.

---

## 6. UX & LAYOUT ISSUES

- **No mobile hamburger menu** — The site has no responsive mobile navigation. At mobile widths, the desktop nav bar persists without collapsing into a hamburger menu. Nav items likely overflow or get cramped on small screens.
- **Excessive whitespace between sections** — There are very large empty gaps between the "Frictionless Journey" section, the feature cards, the pricing section, and the testimonials. These feel like unfinished placeholder spacing.
- **No hover states on feature cards** — The "Smart Context Engine," "Global Scale," "Team Sync," and "Reels & TikTok Ready" cards have no hover interaction, cursor change, or visual feedback, even though they look clickable.
- **Testimonials lack credibility** — Three testimonials are shown, but they only show first name and generic titles ("Content Creator," "Marketing Team," "Freelancer"). No photos, no company names, no links. They read as placeholder content.
- **"+ 50 more" language chip** — In the Supported Languages section, the "+ 50 more" chip looks like a clickable button but does nothing. Should either expand the full list or link to documentation.
- **Notification bell (dashboard)** — The bell icon in the dashboard header has no visible badge/count and no dropdown. It appears non-functional.
- **"Jump to project..." search (dashboard)** — The search box exists but with no projects, there's no indication of what it does or any placeholder guidance beyond the text.
- **Upgrade Plan button (dashboard sidebar)** — Visible but there's no clear indication of what upgrading does or what plan you're currently on beyond "FREE PLAN" label.

---

## 7. PRICING PAGE SPECIFIC ISSUES

- **Free plan doesn't show "Billed monthly/yearly" label** — When toggling between Monthly and Yearly, the Free plan card stays identical. Premium says "Billed monthly" or "Billed yearly" but Free shows nothing, making the toggle feel broken for that card.
- **Strikethrough pricing on Free is missing** — Premium shows ~~$10/mo~~ → $9.50/mo and Pro shows ~~$25/mo~~ → $22/mo, but the Free plan has no original price shown. This inconsistency makes the discounted prices less believable.
- **Yearly pricing math is questionable** — Premium yearly is $8/mo (originally $10/mo) = 20% off. Pro yearly is $20/mo (originally $25/mo) = 20% off. But the homepage pricing section (which duplicates the pricing page) shows $9.50/mo and $22/mo — these are the monthly prices, not yearly. The homepage and pricing page show different numbers depending on toggle state, but the homepage defaults to monthly while the pricing page URL has no toggle memory.
- **No Enterprise/Custom plan** — Most SaaS pricing pages include a "Contact Us" enterprise tier. Missing this for a product claiming Google, IBM, and Nike as users is contradictory.

---

## 8. TECHNICAL & SEO ISSUES

- **No favicon visible** — The favicon URL contains a suspicious query string (`?favicon.0x3dzn~oxb6tn.ico`) suggesting it may be auto-generated or misconfigured.
- **No Open Graph / social sharing meta tags visible** — Sharing this site on social media would show generic or missing previews.
- **Console errors possible from hotlinked Wikipedia images** — External image loading from Wikipedia is fragile and may generate CORS or 403 errors intermittently.

---

## SUMMARY


| Category                     | Issues Found   |
| ---------------------------- | -------------- |
| Dead navigation links        | 3              |
| Dead footer links            | 6              |
| Non-functional buttons       | 10+            |
| Dead dashboard sidebar links | 5              |
| Content/copy mismatches      | 7              |
| Brand/trust issues           | 4              |
| Color/visual issues          | 5              |
| UX/layout issues             | 8              |
| Pricing issues               | 4              |
| Technical issues             | 3              |
| **TOTAL**                    | **~53 issues** |


### Critical Priority Fixes

- Fix all dead `href="#"` links (nav, footer, dashboard) — or remove them
- Wire up CTA buttons ("Start Free Trial," "View All Features," "View Presets")
- Fix the hero headline/subtitle/title mismatch (dubbing vs. transcription vs. captions)
- Replace fake brand logos or remove the section entirely
- Fix the hardcoded "Good morning, Alex" greeting
- Add mobile responsive navigation

---

---

# PART 2: MISSING FEATURES, SUGGESTIONS & INSIGHTS

---

## 9. FEATURES THAT SHOULD EXIST (But Don't)

### A. User Onboarding & First-Time Experience

- **No onboarding flow** — When a new user signs up and lands on the dashboard, there's no welcome tour, no guided walkthrough, no tooltips pointing out where to upload, how credits work, or what "Dubbing" vs. "Subtitles" means. A first-time user is dropped into the app cold.
- **No sample/demo project** — The "Recent Projects" section shows an empty state that says "No projects yet. Upload a file to get started." There should be a pre-loaded sample project so new users can explore what a completed dubbing job looks like — what the output is, what the editor feels like, what export options are available — without spending their credits.
- **No interactive product demo on homepage** — The homepage upload widget is live but there's no way to experience the product before signing up. An embedded video demo, a GIF walkthrough, or even a side-by-side "before/after" audio clip would massively increase conversions.

### B. Core Product Features

- **No drag-and-drop progress feedback** — The upload area says "Drop your file here" but there's no visual drag-over state (no border highlight, no color change, no icon animation). Users can't tell if their drag is being recognized.
- **No file size limit displayed** — The uploader shows accepted formats (MP4, MOV, MP3, WAV, WEBM) but never tells users the maximum file size. Users will hit a mystery error on large files.
- **No upload progress bar** — There's no loading/progress indicator anywhere in the codebase. After a user drops a large video file, they'd see... nothing. No spinner, no percentage, no ETA.
- **No project management** — The "Projects" sidebar exists but is dead. A real dubbing tool needs: project folders, rename/delete projects, search/filter by date or language, tags, and batch operations.
- **No editor/preview for completed dubs** — There's no visible way to preview your dubbed audio/video, edit timestamps, adjust translations, or fine-tune the output before exporting. The "Frictionless Journey" section implies Upload → Convert → Generate → Download, but there's no editing step.
- **No subtitle editor** — For a tool that claims to generate SRT/VTT captions, there's no inline subtitle editor where users can correct timestamps, fix AI transcription errors, split/merge captions, or adjust display timing.
- **No real-time collaboration** — The "Team Sync" feature card claims "Collaborative workspace for production teams to edit and review in real-time," but the dashboard has zero collaboration features: no sharing, no invite team members, no comments, no version history.
- **No export format preview** — Users can't preview what their SRT, VTT, or MP4 output will look like before downloading. A live preview pane would be essential.

### C. Account & Settings

- **No profile/settings page** — The "Settings" option appears in the user dropdown, but there's no actual settings page visible. Users need to be able to change their name, email, password, notification preferences, and default language.
- **No billing/subscription management** — The "Upgrade Plan" button exists, but there's no way to view current subscription, billing history, payment method, download invoices, or cancel a plan.
- **No credit usage analytics** — The sidebar shows "60 / 60 left" but there's no breakdown of how credits were spent, no usage chart over time, no "you'll run out in X days" projection.
- **No API key management** — The footer mentions "API Status" which implies an API exists. But there's no API key generation, documentation, or usage dashboard for developers.

### D. Trust & Legal (Required for a Paid Product)

- **No actual Privacy Policy page** — This is legally required for any product that collects user data, especially one that processes audio/video files. This is not optional.
- **No Terms of Service page** — Also legally required. Users are paying money and uploading potentially sensitive media. Terms must exist.
- **No cookie consent banner** — If the site uses any analytics or third-party scripts (likely), a cookie consent mechanism is required under GDPR/CCPA.
- **No data deletion option** — Users must be able to request deletion of their data and uploaded files. The FAQ mentions "What happens to my files after processing?" but the answer is hidden behind an accordion.

---

## 10. SUGGESTIONS FOR IMPROVEMENT

### Homepage Overhaul

- **Pick one identity and commit.** Is this a dubbing tool, a transcription tool, or a subtitle tool? The homepage, page title, meta description, and hero all need to agree. My recommendation: lead with dubbing (it's the brand name) and position subtitles as a secondary feature.
- **Replace the logo strip** with real testimonials with photos, or case studies from actual creators, or a "Featured on" press section if you've been covered anywhere. If none of these exist yet, remove the section entirely. Fake social proof is worse than none.
- **Add a 60-second product demo video** in the hero area. Show a real video being dubbed from English to Spanish. Let people hear the quality. This single addition would do more for conversions than anything else.
- **The "Frictionless Journey" section is abstract.** Replace the 4-step illustration with an actual screen recording or annotated screenshots showing each step with the real UI.

### Pricing Page Fixes

- **Add a feature comparison table** below the pricing cards. Users want to see Free vs. Premium vs. Pro side by side in a grid. Which features are locked? What exactly does "Lip-sync dubbing" mean? Is it only on Pro?
- **Add a "minutes calculator"** — "How many credits do I need?" Let users input how many minutes of video they dub per month and recommend a plan.
- **Explain the credit system** more clearly. "1 credit = 1 minute of dubbing processing" is stated, but what counts? Does a failed job still consume credits? What about re-processing?
- **Add annual pricing savings callout** — Show the total annual savings in dollars, not just "save 20%." For example: "Save $24/year on Premium" is more persuasive.

### Dashboard Improvements

- **Fix the greeting** — Either use the actual username or ask for a first name during signup. "Good morning, harshjorwal2006" is bad too. Prompt for a display name.
- **Add a "Quick Start" card** for new users showing 3 steps: Upload → Choose Language → Export. Make it dismissible.
- **Show credit burn rate** — "You've used 0 of 60 credits this month. Resets in 28 days." Add a subtle progress ring.
- **Add a drag-and-drop hotzone** that covers more of the dashboard area, not just the small upload box.

### Technical Improvements

- **Add loading states everywhere** — No spinners, no skeleton screens, no progress bars exist anywhere in the codebase. Every async action (upload, processing, page navigation) needs visual feedback.
- **Add form validation** — The upload form has no client-side validation. If someone drops an unsupported file, what happens? There should be clear error messages.
- **Add toast/notification system** — For success messages ("File uploaded!"), errors ("Processing failed"), and warnings ("You're low on credits").
- **Implement dark mode** — The dashboard is where users spend time. A dark mode toggle is standard for media tools.
- **Add keyboard shortcuts** — Power users processing many files will want shortcuts for common actions (upload, switch language, start processing).

### SEO & Marketing

- **Add Open Graph meta tags** — So sharing the site on Twitter/LinkedIn/Slack shows a proper card with image, title, and description.
- **Create actual Use Cases pages** — "Podcasters," "YouTubers," "E-learning," "Corporate Training" — each with a dedicated landing page explaining how Dubbing Studio solves their specific problem.
- **Add a blog/resources section** — Content like "How to dub your YouTube video in 5 minutes" or "Best practices for multilingual content" would drive organic search traffic.
- **Add schema.org structured data** — Product schema, FAQ schema (for the FAQ section), and Organization schema.

---

## 11. STRATEGIC INSIGHTS

### The Identity Crisis is the #1 Problem

The site can't decide if it's a **dubbing** tool, a **transcription** tool, or a **subtitling** tool. The brand name says "Dubbing Studio," the headline says "Dubs," the subtitle says "SRT/VTT captions," the page title says "Transcription," and the meta description says "subtitles." This confusion will hurt at every level — SEO, paid ads, word-of-mouth, investor pitches. Pick "AI Video Dubbing" as the primary positioning, and treat subtitles/transcription as add-on features.

### The Product Feels Like a UI Mockup, Not a Product

With 22+ dead links, non-functional buttons, placeholder testimonials, Wikipedia-hotlinked logos, and a dashboard where 5 of 7 sidebar items don't work — the site currently feels like a Figma prototype that was exported to HTML. If this is an MVP, the landing page needs to be honest about what's ready and what's coming. If it's supposed to be production-ready, there's significant work needed.

### Trust Deficit Will Kill Conversions

Users are being asked to upload their video/audio files and pay money. But there's no Privacy Policy, no Terms of Service, no real testimonials, fake brand logos, and no explanation of how data is handled. The FAQ question "Are my files secure and private?" is a good start, but hiding the answer behind an accordion while having zero legal pages is a red flag.

### The Free Tier Is Generous — Leverage It

30 free credits (= 30 minutes of dubbing) is a strong free offering. But the site does almost nothing to get people to actually try it. No sample file, no demo, no onboarding. The gap between "landing page visitor" and "first successful dub" has too much friction. Reduce that gap to under 60 seconds and conversions will increase dramatically.

### Competitive Positioning Gap

Tools like ElevenLabs, Rask.ai, and HeyGen are in this space. What makes Dubbing Studio different? The homepage doesn't answer this question. Consider adding a "Why Dubbing Studio?" section or a comparison chart against alternatives. The "Smart Context Engine" and "Editorial Precision" cards hint at differentiators but don't explain them clearly enough.

### The "AI Tools" Sidebar Item Is Intriguing But Dead

This could be a significant differentiator if built out — AI-powered tools like tone adjustment, speaker separation, background noise removal, translation quality scoring, etc. Currently it's just a dead link, but this is where the product could create unique value beyond basic dubbing.

---

## PRIORITY ROADMAP (Suggested)

### Phase 1: Fix the Foundation (Week 1-2)

- Fix or remove all dead links
- Wire up all CTA buttons
- Unify the brand messaging (dubbing-first positioning)
- Add Privacy Policy and Terms of Service pages
- Fix "Good morning, Alex" greeting
- Add mobile responsive navigation

### Phase 2: Build Trust (Week 3-4)

- Remove fake logos, add real testimonials or remove the section
- Add a product demo video to the homepage
- Create a sample project for new users
- Add loading states and error handling throughout
- Add Open Graph meta tags

### Phase 3: Complete the Dashboard (Month 2)

- Build the Projects page with search, filter, delete
- Build the Credit History page with usage analytics
- Build the Settings page with profile and billing
- Add onboarding flow for new users
- Implement the subtitle/dub editor with preview

### Phase 4: Growth Features (Month 3+)

- Build out AI Tools section
- Create Use Cases landing pages
- Add API documentation and key management
- Add team collaboration features
- Launch a blog for SEO content
- Add dark mode and keyboard shortcuts

