## Kili – Frontend Design Language

This document defines the **visual and UX language** for the Kili frontend. All new components and pages should follow these rules.

**Source of truth note:** This document works alongside `.cursor/rules/design-system.mdc`. If there’s a conflict, prefer the **semantic tokens** and conventions defined in `design-system.mdc`, and then update this file to match.

---

## 1. Brand Positioning & Voice

- **Primary identity**: AI video **dubbing** tool.  
  - Subtitles/transcription are **supporting features**, not the headline.
- **Copy tone**:
  - Clear, confident, and concise.
  - Avoid jargon; favor short, direct sentences.
  - Speak to **creators** (YouTube, TikTok, course creators), not enterprises.
- **Headlines**:
  - One clear promise per section (e.g. “Turn any video into multilingual dubs in minutes”).
  - Avoid mixing “dubbing”, “transcription”, and “subtitles” in the same line.

---

## 2. Layout & Spacing

- **Page frame**:
  - `max-w-7xl mx-auto px-6 md:px-8` for main content width.
  - Consistent top margin below the navbar (account for fixed header).
- **Vertical rhythm**:
  - Default section spacing: `py-16 md:py-20`.
  - Tight sections (e.g. small CTAs, badges): `py-8–10`.
  - Avoid large “empty” gaps; if a section feels sparse, add supporting content or reduce padding.
- **Grids**:
  - Use Tailwind grid utilities: `grid gap-8 md:grid-cols-2` or `md:grid-cols-3` for feature cards.

---

## 3. Color System

- **Use semantic tokens (preferred)**:
  - Use the semantic aliases from `globals.css` / Tailwind (per `.cursor/rules/design-system.mdc`).
  - Examples:
    - Text: `text-on-surface`, `text-on-surface-variant`, `text-primary`
    - Backgrounds: `bg-surface`, `bg-surface-container-lowest`, `bg-primary`
    - Borders: `border-outline-variant`
- **Accent (sparingly)**:
  - One secondary accent is fine, but keep it rare and consistent.
- **Rules**:
  - Don’t introduce raw hex colors or random Tailwind palette colors in new UI.
  - Secondary actions use `outline` or `ghost` variants with gray/neutral tones.
  - Maintain sufficient contrast for accessibility (aim for WCAG AA).

---

## 4. Typography

- **Font families**:
  - `--font-manrope` for headings and prominent labels.
  - `--font-inter` for body text and UI copy.
- **Heading hierarchy**:
  - Prefer the named type-scale tokens (e.g. `text-h1 md:text-display`) defined in `design-system.mdc`.
- **Body text**:
  - Default: `text-body` / `text-body-lg` with semantic text colors.
  - Avoid more than 70–80 characters per line; use `max-w-2xl/3xl`.

---

## 5. Buttons & CTAs

- **Primary button**:
  - Use shared `Button` component with `variant="primary"` and `size` (`sm`, `md`, `lg`).
  - Copy: prefer **“Get started”** or **“Start free trial”**; use the **same label** for the same action across the app.
  - Only one primary CTA per visual block (hero, pricing, footer).
- **Secondary button**:
  - Use outline/ghost variants for less-important actions (e.g. “Learn more”).
  - Never outshine the primary CTA (no stronger color/size).
- **States**:
  - Every button must have hover and active states (scale, shadow, or subtle color shift).

---

## 6. Reusable Components Catalog (keep updated)

This is the inventory of reusable frontend components. **If you add a new reusable component (anything meant to be used in 2+ places), you must add it here** with a one-line description.

### UI primitives (use everywhere)

- **`components/ui/Button.tsx`**: The only allowed button for clickable actions (variants/sizes in `design-system.mdc`).
- **`components/Toaster.tsx`**: Global toast container (use for async success/error feedback).

### Navigation & layout

- **`components/Navbar.tsx`**: Marketing/main navbar (non-dashboard).
- **`components/AppNavbar.tsx`**: App/dashboard navbar (if used for authenticated areas).
- **`components/Footer.tsx`**: Site footer.

### Marketing sections (landing/pricing)

- **`components/HeroSection.tsx`**: Landing hero.
- **`components/FeaturesSection.tsx`**: Feature grid/section wrapper.
- **`components/HowItWorks.tsx`**: Step-by-step section.
- **`components/TestimonialsSection.tsx`**: Testimonials section.
- **`components/LanguageListSection.tsx`**: Supported languages section.
- **`components/FAQSection.tsx`** / **`components/PricingFAQ.tsx`**: FAQ sections.
- **`components/PricingSection.tsx`** / **`components/PricingPlansGrid.tsx`**: Pricing UI.
- **`components/CTASection.tsx`**: Bottom CTA block.

### Upload / onboarding

- **`components/UploadCard.tsx`**: Marketing upload card UI.
- **`components/UploadButton.tsx`**: Upload CTA/button component.
- **`components/TempUserInit.tsx`**: Temp user initialization flow.

### Dashboard components

- **`components/dashboard/DashboardHeader.tsx`**: Dashboard top header.
- **`components/dashboard/DashboardSidebar.tsx`**: Dashboard sidebar/nav.
- **`components/dashboard/UploadZone.tsx`**: Dashboard drag/drop upload area.
- **`components/dashboard/UploadFAB.tsx`**: Floating upload action button.
- **`components/dashboard/ProjectList.tsx`**: Project list container.
- **`components/dashboard/ProjectCard.tsx`**: Project card item.
- **`components/dashboard/DashboardInit.tsx`**: Dashboard initialization logic/UI.

### Dubbing editor components

- **`components/dubbingEditor/EditorShell.tsx`**: Editor layout shell.
- **`components/dubbingEditor/TopBar.tsx`**: Editor header controls.
- **`components/dubbingEditor/LeftPanel.tsx`**: Left side panel.
- **`components/dubbingEditor/CenterStage.tsx`**: Main editor stage.
- **`components/dubbingEditor/RightInspector.tsx`**: Inspector / properties panel.
- **`components/dubbingEditor/BottomTimeline.tsx`**: Timeline panel.
- **`components/dubbingEditor/DubbingEditorContext.tsx`**: Editor state/context provider.

### Auth

- **`components/auth/AuthForm.tsx`**: Shared auth form.
- **`components/auth/login.tsx`**: Login view component (if still needed separate from `AuthForm`).

### Visual utilities

- **`components/FadingCircle.tsx`**: Decorative/animated visual element.
- **`components/reactBit/LogoLoop.tsx`**: Logo carousel/loop.

---

## 7. Links, Nav, and Routing

- **No dead links**:
  - Never use `href="#"` or non-functional buttons.
  - If a page/feature doesn’t exist yet:
    - Hide the link, **or**
    - Use a clearly labeled “Coming soon” badge + non-clickable text.
- **Navbar**:
  - Top-level items should map to real routes: `Product`, `Pricing`, `Dashboard`, `Docs` (when ready).
  - Use `usePathname` or similar to highlight the active route.
- **Footer**:
  - Include only links that exist (e.g. `Privacy Policy`, `Terms`, `Help`).

---

## 8. Components & Interaction

- **Cards**:
  - Use consistent padding (`p-6 md:p-8`), rounded corners (`rounded-2xl`), and soft borders or shadows.
  - If a card looks clickable, it **must** have:
    - `cursor-pointer`
    - A hover treatment (shadow, translate, or border color change).
- **Hover & focus**:
  - All interactive elements (buttons, links, nav, chips, toggles) must have hover + focus-visible styles.
- **Feedback**:
  - All async actions (upload, processing, saving) must show:
    - A loader (spinner, progress bar, or skeleton).
    - Success and error toasts/snackbars where appropriate.

---

## 9. Responsive Behavior

- **Breakpoints**:
  - Design for `sm`, `md`, and `lg` explicitly.
  - Navbar:
    - Desktop: inline links.
    - Mobile: **hamburger menu** with a full-screen or sheet-style menu.
- **Stacking**:
  - On small screens, stack columns into a single column with `space-y-*`.
  - Ensure CTAs remain visible without excessive scrolling.

---

## 10. Content & Trust

- **Logos & social proof**:
  - Only use logos from real customers or partners you’re allowed to reference.
  - Do **not** hotlink images from external sites (e.g. Wikipedia).
  - If there are no real logos yet, omit the logo strip.
- **Testimonials**:
  - Use full names, roles, and optionally avatars/photo if real.
  - Avoid placeholder content with generic names and titles.
- **Legal**:
  - Always have real `Privacy Policy` and `Terms of Service` pages linked from footer.

---

## 11. Copy & Naming Conventions

- **Product naming**:
  - Use `Kili` consistently (no alternate product names).
- **Feature naming**:
  - “Dubbing” for voice-over outputs.
  - “Subtitles” for SRT/VTT.
  - “Transcription” only when referring to raw text output.
- **Microcopy**:
  - Prefer action-oriented labels: “Upload file”, “View project”, “Start dubbing”.
  - Error messages: state what happened + how to fix it.

---

## 12. Implementation Checklist for New UI

Before merging any new page or component:

- [ ] Uses shared fonts (`Manrope`, `Inter`) and Tailwind utility patterns already in the app.
- [ ] Follows color and button rules (single primary CTA, proper hover states).
- [ ] No `href="#"` and no non-functional buttons.
- [ ] Responsive at common breakpoints (mobile, tablet, desktop).
- [ ] Copy is dubbing-first, clear, and consistent with this design language.

