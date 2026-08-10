# Relay Email Design System

> Feed this file to an AI to regenerate any Relay transactional email that matches the established design language. All values are exact — do not approximate.

---

## 1. Philosophy

The design is **minimal, content-first, and borderless**. Inspiration: Linear, Vercel, Resend. Key traits:

- White background — no card-on-gray boxing. Content breathes.
- System font stack — renders natively on every device, no web font loading latency.
- Tight negative letter-spacing on headings — gives text a modern, intentional feel.
- Zinc colour palette — no pure black/white. Everything is slightly warm-neutral.
- Separators instead of borders — thin `#f4f4f5` lines create structure without visual noise.
- All styles are **explicit inline `React.CSSProperties` objects** — never Tailwind utility classes on content. This is required for email client compatibility.

---

## 2. Typography

### 2.1 Font Stack

All text in all templates uses a single `sans` constant. **This is the only place you need to change to swap the font.**

```ts
const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
```

**To change the font** (e.g. to Inter from Google Fonts):

1. Add a `<Font>` component inside `<Head />` in `Layout.tsx`:

   ```tsx
   import { Font } from "@react-email/components";

   // inside <Head>:
   <Font
     fontFamily="Inter"
     fallbackFontFamily="Arial"
     webFont={{
       url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
       format: "woff2",
     }}
     fontWeight={400}
     fontStyle="normal"
   />;
   ```

2. Update the `sans` constant in **both** `Layout.tsx` and any email template files (`DemoEmail.tsx`, etc.) to `"Inter, Arial, sans-serif"`.

### 2.2 Type Scale

| Role            | Size | Weight | Color     | Letter-spacing | Line-height |
| --------------- | ---- | ------ | --------- | -------------- | ----------- |
| Wordmark        | 15px | 700    | `#09090b` | `-0.02em`      | —           |
| Heading (H1)    | 22px | 700    | `#09090b` | `-0.025em`     | `1.3`       |
| Section heading | 13px | 600    | `#09090b` | `-0.01em`      | —           |
| Body copy       | 14px | 400    | `#52525b` | —              | `1.65`      |
| Label / eyebrow | 11px | 600    | `#a1a1aa` | `+0.08em`      | —           |
| Meta label      | 12px | 500    | `#a1a1aa` | —              | —           |
| Meta value      | 12px | 400    | `#09090b` | —              | —           |
| Disclaimer      | 12px | 400    | `#a1a1aa` | —              | `1.6`       |
| Footer          | 12px | 400    | `#a1a1aa` | —              | `1.6`       |

Label / eyebrow text always uses `textTransform: "uppercase"`.

---

## 3. Colour Palette

All colours are from the Zinc scale (Tailwind Zinc).

| Token    | Hex       | Usage                                                 |
| -------- | --------- | ----------------------------------------------------- |
| zinc-950 | `#09090b` | Primary text, wordmark, headings, button bg           |
| zinc-600 | `#52525b` | Body copy                                             |
| zinc-400 | `#a1a1aa` | Muted labels, footer, disclaimers                     |
| zinc-200 | `#e4e4e7` | Card borders (if card layout is used)                 |
| zinc-100 | `#f4f4f5` | Separator lines, meta box border, background fallback |
| zinc-50  | `#fafafa` | Meta box background                                   |
| white    | `#ffffff` | Email body background                                 |
| red-600  | `#dc2626` | Danger button background only                         |

---

## 4. Layout & Spacing

### 4.1 Page Structure (from `Layout.tsx`)

```
<Body>                      — white bg, 48px top/bottom padding
  <Container>               — max-width 600px, 0 auto, 32px horizontal padding
    <Section> (header)      — wordmark left-aligned
                              24px bottom padding
                              1px solid #f4f4f5 bottom border + 32px margin-bottom
    <Section> (content)     — children render here, no box/border/bg
    <Section> (footer)      — left-aligned
                              1px solid #f4f4f5 top border
                              40px top padding, 32px top margin
  </Container>
</Body>
```

### 4.2 Content Spacing Conventions

| Element               | Value                 |
| --------------------- | --------------------- |
| After H1 heading      | `margin-bottom: 12px` |
| After eyebrow label   | `margin-bottom: 14px` |
| After section heading | `margin-bottom: 6px`  |
| After body copy       | `margin-bottom: 20px` |
| Horizontal rule       | `margin: 24px 0`      |
| After button section  | `padding-bottom: 8px` |

### 4.3 Horizontal Rule

```ts
const hrStyle: React.CSSProperties = {
  borderTop: "1px solid #f4f4f5",
  borderBottom: "none",
  borderLeft: "none",
  borderRight: "none",
  margin: "24px 0",
};
```

---

## 5. Components

### 5.1 Layout (`src/emails/components/Layout.tsx`)

Wraps every email. Props: `previewText: string`, `children: React.ReactNode`.

Renders: `<Html lang="en">` → `<Head>` → `<Preview>` → `<Body>` → `<Container>` → wordmark header + children + footer.

### 5.2 Button (`src/emails/components/Button.tsx`)

Props: `href: string`, `children: React.ReactNode`, `variant?: "primary" | "danger"` (default: `"primary"`)

```ts
// Shared base
display: "inline-block"
borderRadius: "8px"
padding: "12px 28px"
fontSize: "14px"
fontWeight: "600"
letterSpacing: "0.01em"
textDecoration: "none"
textAlign: "center"

// primary
backgroundColor: "#09090b", color: "#ffffff"

// danger
backgroundColor: "#dc2626", color: "#ffffff"
```

> Do not add Tailwind classes to `<Button>`. Always use the `style` prop.

### 5.3 Meta Info Box

A `<Section>` containing `<Row>` + `<Column>` pairs. Left label column: `width: 100px`.

```ts
// Container
backgroundColor: "#fafafa", borderRadius: "8px", border: "1px solid #f4f4f5"
paddingTop/Bottom: "4px", paddingLeft/Right: "16px", marginBottom: "20px"

// Label text
fontSize: "12px", fontWeight: "500", color: "#a1a1aa", margin: "6px 0"

// Value text
fontSize: "12px", fontWeight: "400", color: "#09090b", margin: "6px 0"
```

---

## 6. Content Patterns

### 6.1 Email Opening (required)

1. **Eyebrow label** — 11px, uppercase, `#a1a1aa`, `margin-bottom: 14px`
2. **H1 heading** — 22px, 700 weight, tight tracking, `#09090b`, `margin-bottom: 12px`
3. **Intro paragraph** — 14px body copy with recipient bolded inline:
   ```tsx
   <span style={{ color: "#09090b", fontWeight: "600" }}>{recipientEmail}</span>
   ```

### 6.2 Repeating Section

1. Section heading (13px, 600, `#09090b`)
2. Body copy paragraph
3. Optional block component (button, meta box)
4. `<Hr style={hrStyle} />` before next section

### 6.3 Inline Emphasis

```tsx
// Bold value
<span style={{ color: "#09090b", fontWeight: "600" }}>value</span>

// Inline code / identifier
<span style={{ fontFamily: "monospace", fontSize: "13px", color: "#09090b" }}>id</span>
```

### 6.4 Email Closing (required)

1. `<Hr style={hrStyle} />`
2. Disclaimer — 12px, `#a1a1aa`: _"If you received this by mistake, you can safely ignore it."_

---

## 7. File Locations

| File                                     | Purpose                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| `src/emails/components/Layout.tsx`       | Shell. Update `sans` here to change the global font.    |
| `src/emails/components/Button.tsx`       | CTA button, `primary` + `danger` variants.              |
| `src/emails/DemoEmail.tsx`               | **Reference implementation** of the full design system. |
| `src/emails/MagicLinkEmail.tsx`          | Magic link auth email.                                  |
| `src/emails/OtpEmail.tsx`                | OTP code email.                                         |
| `src/emails/PasswordResetEmail.tsx`      | Password reset email.                                   |
| `src/emails/SecurityAlertEmail.tsx`      | Security alert, multi-variant.                          |
| `src/emails/SignupVerificationEmail.tsx` | Email verification on signup.                           |

---

## 8. AI Regeneration Prompt

```
Build a transactional email template using @react-email/components and React (TSX).
Follow these rules exactly:

STRUCTURE
- Wrap in Layout from ./components/Layout with a previewText prop.
- Use Button from ./components/Button for all CTAs.
- Export as both named and default export.

STYLES
- All styles: typed React.CSSProperties inline objects. No Tailwind classes on content.
- const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
- Set fontFamily: sans on EVERY style object — do not rely on CSS inheritance.

COLOURS (Zinc only)
- #09090b — headings, primary text, button bg, bold values
- #52525b — body copy
- #a1a1aa — muted labels, eyebrows, footer, disclaimers
- #f4f4f5 — separator lines, meta box borders
- #fafafa — meta box background

TYPOGRAPHY
- Eyebrow: 11px, weight 600, uppercase, letterSpacing +0.08em, color #a1a1aa, marginBottom 14px
- H1: 22px, weight 700, letterSpacing -0.025em, lineHeight 1.3, color #09090b, marginBottom 12px
- Section heading: 13px, weight 600, letterSpacing -0.01em, color #09090b, marginBottom 6px
- Body: 14px, weight 400, lineHeight 1.65, color #52525b, marginBottom 20px
- Disclaimer: 12px, weight 400, lineHeight 1.6, color #a1a1aa

CONTENT PATTERN
1. Eyebrow label
2. H1 heading
3. Intro paragraph — bold recipient email inline with: color #09090b, fontWeight 600
4. <Hr> (borderTop 1px solid #f4f4f5, margin 24px 0) between sections
5. Each section: section heading → body copy → optional component
6. Close with <Hr> + disclaimer paragraph
```
