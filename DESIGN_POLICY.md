# KashNode Product & Marketing Design Policy

**Status:** Proposed source of truth  
**Scope:** Public marketing website, product positioning, landing pages, product visuals, and responsive presentation  
**Audience:** Product, design, frontend, content, and engineering contributors

> This policy defines how KashNode presents and explains its product. It is intentionally product-first: customers should understand the e-commerce operation problem, the automation workflow, and the value of the software before they learn about the KashNode brand or its hardware.

---

## 1. Product definition — the most important rule

### What KashNode sells

**KashNode is an e-commerce operations automation platform.**

It helps online merchants reduce repetitive operational work across the order lifecycle: order verification, payment confirmation, customer communication, and fulfilment handoff.

The website must sell the **automation outcome and connected software workflow**, not the company name, a device, or a collection of unrelated features.

### Primary positioning

Use this positioning as the default:

**Category:** E-commerce operations automation  
**Primary audience:** Online merchants and e-commerce teams  
**Primary promise:** Automate repetitive order operations from verification to fulfilment.  
**Product form:** A connected software platform with optional device-connected capabilities where required.

Suggested headline direction:

- “Automate the work between checkout and fulfilment.”
- “Keep every order moving, without the manual follow-up.”
- “One workflow for order verification, payment checks, and fulfilment.”

These are positioning directions, not mandatory copy. The final copy must match the capabilities actually available in production.

### What KashNode is not

Do not position KashNode as:

- A generic website builder or online store platform.
- A cloud hosting provider or developer infrastructure platform.
- A payment gateway, bank, mobile financial service, or payment processor.
- A courier company.
- A hardware-first SIM box company.
- A broad “AI for everything” product.

KashNode connects and automates parts of an existing e-commerce operation. It does not replace the merchant's store, payment provider, or courier.

### Message hierarchy

Every important marketing surface should answer these questions in order:

1. **What is it?** An e-commerce operations automation platform.
2. **Who is it for?** Merchants and teams running online stores.
3. **What work does it automate?** Verification, payment matching, customer calls/follow-ups, and fulfilment handoff.
4. **How does it work?** A connected workflow using the merchant's store, configured payment signals, AI voice, and supported fulfilment integrations.
5. **What changes for the customer?** Less manual checking, fewer avoidable dispatch mistakes, and clearer operational visibility.
6. **How can I start?** Create a workspace; introduce device requirements only when relevant.

Do not lead with “Welcome to KashNode”, a company story, hardware specifications, or a list of technologies.

---

## 2. Reference principles — learn from, never imitate

The quality bar is informed by product-led international SaaS companies such as Stripe, Render, and Shopify. Their websites are references for communication and information architecture, not visual templates to copy.

Apply these transferable principles:

- **Stripe:** Explain a complex product in clear business language; support claims with concrete product surfaces, proof, and precise information.
- **Render:** Make the product workflow understandable through a simple sequence, clear capability groups, and real interface visuals.
- **Shopify:** Speak to the merchant's daily work and outcomes; organize capabilities around practical commerce tasks.

Do not copy their logos, illustrations, page layouts, distinctive gradients, copy, iconography, or exact component styling. KashNode must have its own recognizable identity.

---

## 3. Brand personality and visual direction

KashNode should feel:

- Professional and internationally credible.
- Calm, precise, capable, and operationally dependable.
- Modern SaaS rather than a flashy AI landing page.
- Merchant-focused, practical, and transparent.
- Confident without exaggerated enterprise claims.

### Visual principles

1. Product clarity before decoration.
2. Strong typographic hierarchy before color effects.
3. Realistic product UI before abstract illustrations.
4. Consistent spacing before shadows and gradients.
5. One clear primary action per visual section.
6. White space is intentional; do not fill every empty area.
7. Every section must have a clear purpose in the customer journey.

Avoid excessive glassmorphism, neon gradients, glowing borders, random blobs, oversized decorative icons, emoji, and multiple competing accent colors.

### KashNode color tokens

Use the existing KashNode palette as the baseline:

| Token | Value | Use |
|---|---|---|
| Page background | `#F8FAFC` | Main page canvas |
| Surface | `#FFFFFF` | Cards, navigation, product panels |
| Primary | `#267B66` | Main CTA, active states, restrained emphasis |
| Primary hover | `#206D5A` | Hover/pressed state |
| Heading | `#0F172A` | Headlines and section titles |
| Body | `#334155` | Paragraphs and descriptions |
| Muted | `#64748B` | Captions, metadata, helper text |
| Border | `#E2E8F0` | Dividers, card outlines |
| Soft surface | `#F1F5F9` | Secondary section backgrounds |

Rules:

- Teal is the single brand accent. Do not introduce purple, pink, cyan, orange, or a second “brand” color.
- Use semantic status colors only inside product UI when their meaning is clear; they are not marketing accents.
- Do not use the primary teal for long body paragraphs.
- Maintain readable contrast. Never place muted text on a similarly muted background.
- Gradients are optional and rare. A flat, well-composed surface is preferred to a decorative gradient mesh.

---

## 4. Typography system

Use one consistent UI sans-serif family throughout the marketing site. Prefer the project's loaded font when it is available; otherwise use a consistent modern sans-serif fallback. Do not mix unrelated font families between sections.

### Type scale

| Role | Desktop | Mobile | Weight | Line height |
|---|---:|---:|---:|---:|
| Hero heading | 56px max | 36px max | 600–700 | 1.05–1.12 |
| Page/section heading | 40px | 30px | 600–700 | 1.12–1.2 |
| Section subheading | 24px | 21px | 600 | 1.25–1.35 |
| Card heading | 18–20px | 18px | 600 | 1.3 |
| Lead paragraph | 18px | 16px | 400 | 1.6–1.7 |
| Body paragraph | 16px | 15–16px | 400 | 1.6–1.7 |
| Supporting text | 14px | 14px | 400 | 1.5 |
| Metadata | 12px | 12px | 500 | 1.4 |

Rules:

- Use sentence case for headings. Avoid unnecessary ALL CAPS.
- A heading and its supporting paragraph must be visually distinct in size, weight, color, and spacing.
- Never allow a paragraph to inherit heading styles or a heading to inherit body styles.
- Keep heading line lengths controlled; use balanced wrapping where supported.
- Do not use ultra-thin font weights for essential product messaging.
- Avoid arbitrary per-component font sizes outside this scale without a documented reason.

---

## 5. Layout, grid, and spacing

### Content container

- Maximum marketing content width: **1200px**.
- Wide product-demo compositions may extend to **1280px** when necessary.
- Center the container with consistent horizontal gutters.
- Desktop gutter: 32–40px.
- Tablet gutter: 24px.
- Mobile gutter: 16–20px.
- Do not let text or cards touch the viewport edge.

### Spacing scale

Use an 8px base rhythm:

- 4px: micro alignment only.
- 8px: compact internal gap.
- 12px: related inline elements.
- 16px: standard component gap.
- 24px: card/content spacing.
- 32px: grouped content spacing.
- 48px: section subgroups.
- 64px: standard section separation.
- 80–96px: spacious desktop section separation.

Do not use arbitrary margin patches to fix one viewport while breaking another. Layout should be solved at the component/container level.

### Grid rules

- Desktop: use 12-column thinking; common content layouts are 6/6 or 5/7.
- Tablet: reduce to 2 columns only when each column remains comfortably readable.
- Mobile: stack content into one column.
- Cards in a row must have consistent alignment, internal padding, and action placement.
- Never force a fixed width that causes horizontal overflow.

---

## 6. Responsive policy — mandatory viewport targets

Responsive behavior is a design requirement, not a final CSS patch.

| Viewport | Expected behavior |
|---|---|
| 1440px and wider | Full desktop composition; balanced text and product visual; generous whitespace |
| 1280px | Desktop grid remains stable; no clipped or compressed columns |
| 1024px | Compact desktop/tablet transition; navigation and product visual adapt cleanly |
| 768px | Tablet layout; grids reduce to two columns where appropriate |
| 430px | Mobile single-column layout; comfortable touch targets |
| 375px | Narrow mobile; no clipped headings, buttons, cards, or horizontal scrolling |
| 320px | Minimum supported width; content remains usable without overlap |

### Responsive rules

- Navigation must collapse before its items collide or wrap unpredictably.
- Hero content must have a deliberate reading order: product category, headline, explanation, primary action, supporting proof, then product visual (or a documented alternative).
- Hero buttons stack on narrow screens and remain at least 44px tall.
- Text must wrap naturally; never solve overflow by shrinking essential text excessively.
- Product screenshots and mockups must scale within their containers. Do not scale a desktop dashboard until its text becomes unreadable.
- On mobile, simplify complex product visuals to the most meaningful panel or a clear crop; do not merely squeeze a multi-panel desktop composition.
- Multi-column sections stack in a meaningful order. Text should not become separated from the visual it explains.
- Cards must not become narrow columns with awkward word wrapping.
- Tables should use a deliberate mobile treatment: horizontal scroll with clear affordance, or a stacked data presentation.
- No horizontal page overflow at any target width.
- Test portrait mobile and tablet; do not assume desktop browser resizing is sufficient.

---

## 7. Homepage information architecture

The homepage should tell one coherent product story. Recommended sequence:

### 1. Navigation

- Product wordmark.
- Product links: Platform/How it works, Features, Integrations, Pricing.
- Secondary action: Sign in.
- Primary CTA: Create workspace / Get started.
- Mobile navigation must be simple, keyboard accessible, and easy to close.

### 2. Hero — sell the outcome

Required content:

- A short category eyebrow: “E-commerce operations automation”.
- One specific headline about automating work between checkout and fulfilment.
- One concise paragraph naming the main workflow.
- One primary CTA.
- One secondary text/link CTA at most.
- A product screenshot or realistic dashboard/workflow visual.

The first screen must make the product category obvious without requiring the visitor to scroll.

Do not put several competing cards, a long feature list, device sales pitch, and a dense dashboard all at the same visual level in the hero.

### 3. Proof/capability bar

Show 3–4 concise capabilities, not five or more crowded mini-cards. Examples: Order verification, Payment matching, Customer communication, Fulfilment handoff.

### 4. How the workflow works

Show the end-to-end process in a small number of clear steps:

1. Order arrives from the merchant's store.
2. Customer/order verification is performed.
3. Payment signals are checked and matched.
4. Verified orders move to the configured fulfilment workflow.
5. The merchant tracks activity from one workspace.

Only show steps supported by the current implementation. Mark integrations or actions that are not live as “planned”, “in setup”, or omit them.

### 5. Core capabilities

Organize features by the merchant's job, not by internal technical modules:

- Order and customer verification.
- Payment message matching.
- AI voice calls and follow-ups.
- Courier/fulfilment workflow.
- Operational dashboard and activity history.

Each capability should include:
- A clear benefit-led heading.
- One short explanation.
- A relevant product UI visual or workflow detail.
- A link to a deeper feature page when one exists.

### 6. Integrations

Show only integrations that are implemented and available. Distinguish:
- Available now.
- Requires merchant configuration.
- In development / planned.

Do not imply an integration is live just because its name appears in source code or marketing copy.

### 7. Product/device explanation

The KashNode Box is a supporting device for workflows that need a merchant SIM connection. It is not the core product category and must not dominate the homepage.

Explain:
- Which workflow requires it.
- What the device does.
- What can be done without it.
- When a merchant should consider it.

Keep hardware details on the dedicated hardware page and use a compact homepage introduction.

### 8. Trust and operational clarity

Use verifiable information only:
- How merchant data and credentials are handled.
- What is automated and what requires merchant action.
- Current integration availability.
- Support/contact route.
- Clear privacy and terms links.

Never invent customer logos, customer counts, uptime, certifications, security audits, compliance claims, or testimonials.

### 9. Pricing

Explain pricing in plain language:
- What is included.
- Usage limits.
- What happens when a limit is exceeded.
- Which capabilities require configuration or hardware.
- Whether a plan is trial, paid, or planned.

Do not hide material usage conditions in tiny text.

### 10. FAQ and final CTA

Answer genuine purchase questions, then finish with one strong CTA. Avoid repeating the entire feature list in the closing section.

---

## 8. Product visuals and UI mockups

The website is selling software automation. Product visuals must prove what the software does.

Preferred visual hierarchy:

1. Real screenshots of the current product.
2. Accurate, clearly labelled product mockups based on current UI.
3. Simple workflow diagrams when a screenshot cannot explain the process.
4. Decorative illustration only as a last resort.

Rules:

- Do not fabricate dashboard metrics, customer records, payment success, courier statuses, or AI call results and present them as real.
- If a visual is illustrative, label it “Illustrative preview” or “Sample data”.
- Product mockups should use consistent browser/app chrome, typography, spacing, and surface colors.
- Desktop visuals should show enough context to understand the workflow.
- Mobile visuals should be art-directed for mobile, not just scaled-down desktop screenshots.
- Use real product language and realistic sample data.
- Do not make the device the largest visual on the homepage unless the page is specifically about the device.

---

## 9. Components and interaction rules

### Buttons

- Primary button: solid KashNode teal, white label.
- Secondary button: white/transparent surface with a restrained border and dark label.
- Text links: teal, clearly distinguishable.
- One primary CTA per section is the default.
- Minimum target height: 44px on touch devices.
- Buttons need visible hover, focus, pressed, disabled, and loading states.
- Button labels should describe an action: “Create workspace”, “Explore features”, “View pricing”.

### Cards

- White surface, 1px `#E2E8F0` border, 8–12px radius.
- Use restrained shadow only when elevation communicates hierarchy.
- Default padding: 24px desktop, 20px mobile.
- Avoid nesting cards inside cards without a clear reason.
- Do not turn every paragraph into a card. Use editorial sections and whitespace.

### Icons

- Use one icon family consistently.
- Icons support the label; they do not replace it.
- Keep icon size and stroke weight consistent.
- Avoid decorative icon badges on every element.

### Motion

- Use subtle transitions for navigation, buttons, and state changes.
- Respect `prefers-reduced-motion`.
- Do not animate text continuously or use motion that delays access to content.
- Animation must explain a product action, not distract from the message.

---

## 10. Content and claims policy

### Voice

- Clear, specific, confident, and practical.
- Write for merchants, not developers, unless the page is explicitly technical.
- Prefer active voice and short sentences.
- Explain unfamiliar terms the first time they appear.
- Avoid generic phrases such as “revolutionary”, “next-generation”, “seamless ecosystem”, “game-changing”, and “AI-powered everything”.

### Truthfulness

The website must reflect the actual state of the product.

Use these labels consistently:
- **Available:** usable in the current production product.
- **Requires setup:** available after credentials, device pairing, or merchant configuration.
- **Beta:** available to a limited set of users or with known limitations.
- **Planned:** not yet available; do not place it beside live features without a clear label.
- **Illustrative:** visual/sample content, not a live customer record.

Never turn a demo response into a live integration claim. Never claim a courier integration, payment provider, device capability, automation, or security control is production-ready without implementation evidence.

### Naming

- “KashNode” is the product/company name, not the product category.
- Lead with “e-commerce operations automation platform”.
- Use “KashNode Box” only when discussing the optional connected device.
- Keep product terminology consistent across navigation, landing pages, dashboard, pricing, and support content.

---

## 11. Accessibility and quality requirements

- Semantic heading order: one primary `h1` per page, then logical `h2` and `h3`.
- Never choose heading tags only for their visual size.
- Text contrast must meet WCAG 2.2 AA.
- All interactive elements must be keyboard reachable with visible focus.
- Images need meaningful alt text; decorative images use empty alt text.
- Forms need visible labels and understandable error messages.
- Mobile tap targets should be at least 44×44px where practical.
- Do not rely on color alone to communicate status.
- Respect reduced-motion settings.
- Use responsive images and avoid layout shift.

---

## 12. Definition of done — no visual PR is complete without this

Before approving a marketing UI change:

### Product clarity
- [ ] A first-time visitor can identify the product category within five seconds.
- [ ] The page explains the merchant problem and the automation outcome.
- [ ] The workflow is understandable without reading every feature detail.
- [ ] Optional hardware is clearly secondary to the software platform.
- [ ] Live, setup-required, beta, planned, and illustrative states are honest.

### Visual consistency
- [ ] Only the approved color tokens are used.
- [ ] Heading, subheading, body, and caption styles are visibly distinct.
- [ ] Spacing follows the documented rhythm.
- [ ] Cards, buttons, icons, and product visuals use consistent geometry.
- [ ] No decorative effect competes with the product message.

### Responsive validation
- [ ] Review at 1440px, 1280px, 1024px, 768px, 430px, 375px, and 320px.
- [ ] No horizontal page overflow.
- [ ] No clipped or overlapping text.
- [ ] Buttons remain visible and tappable.
- [ ] Navigation works with keyboard and touch.
- [ ] Product visuals remain understandable at mobile size.
- [ ] Section order remains logical on mobile.

### Engineering validation
- [ ] No conflicting late-file CSS overrides are added as a shortcut.
- [ ] Shared components use shared tokens rather than one-off values.
- [ ] Check console and network errors.
- [ ] Run the project build and relevant tests.
- [ ] Capture desktop and mobile screenshots for review.
- [ ] State clearly what was and was not tested.

A PR that only looks correct at one desktop width is not complete.

---

## 13. Governance and relationship to existing design files

This document is the **product positioning and marketing design policy** for KashNode.

- It supersedes conflicting marketing direction in older exploratory design notes.
- Existing application/dashboard styling may continue to use its documented application tokens until separately reviewed.
- Do not blindly apply marketing typography or layout rules to authenticated dashboard screens.
- When an implementation decision conflicts with this policy, document the exception and its reason in the PR.
- Update this policy before introducing a new brand color, typography family, major marketing component, or new product category.

**The governing principle:** Every design decision should make the e-commerce automation product easier to understand, trust, and start using.
