# Show Time App Audit (April 19, 2026)

## Executive Summary

The app is functionally strong and mission-focused, but its long-term maintainability risk is concentrated in one place: **all domain logic, UI state, and presentation concerns are coupled inside one large `index.html` module**. The highest-leverage improvement is to adopt a single, holistic modernization track: **a design-system + domain-engine split**.

Instead of many one-off bug fixes, this approach standardizes behavior, improves accessibility, aligns with Apple Human Interface Guidelines (HIG), and makes future rule changes safer.

---

## What’s Working Well

- Clear mission workflow (Setup → Times → Output) with sensible defaults.
- Thoughtful timezone handling (local + Zulu) and day-roll logic for cross-midnight events.
- Warning system for timing conflicts and out-of-order cases.
- Offline capability through service worker and PWA metadata.

---

## Major Findings

## 1) Architecture & Maintainability

### Observation
- Core calculation logic and all interface logic are co-located in `index.html`.
- Similar logic is duplicated in `test.html` for validation.

### Impact
- Higher risk of drift between production logic and test logic.
- Harder reviews, harder onboarding, and slower changes when mission rules evolve.

### Holistic Fix
Create a standalone, pure `mission-timing` engine (single source of truth), then consume it from both app and tests.

---

## 2) UI Consistency & HIG Alignment

### Observation
- Styling is mostly coherent but currently expressed as many ad-hoc inline values.
- Typography/spacing scales are not tokenized; this can drift as features expand.

### Impact
- Inconsistent visual rhythm over time (font sizes, paddings, section density).
- Harder to systematically enforce HIG-consistent hierarchy and touch targets.

### Holistic Fix
Adopt a compact design token layer (color, typography, spacing, radius, elevation) and map components (buttons, cards, table, toggles, banners) to tokens.

---

## 3) Accessibility & Interaction Resilience

### Observation
- Inputs and controls are generally labeled, but there is no global keyboard focus treatment and limited semantic/status regions.

### Impact
- Reduced clarity for keyboard users and assistive technology.
- Warning/success status updates are less discoverable.

### Holistic Fix
Introduce an accessibility baseline:
- visible focus ring standard,
- ARIA live region for copy success/warnings,
- semantic grouping with `fieldset`/`legend` where appropriate,
- preserve 44pt touch targets in all interactive elements.

---

## 4) PWA Portability / Future-Proofness

### Observation
- Manifest routing values are deployment-path specific.

### Impact
- Installation behavior can break or become inconsistent when hosted at a different path.

### Holistic Fix
Use relative `start_url`/`scope` and relative SW registration paths to keep the app portable across environments.

---

## Recommended Single Program of Work

If only one initiative is approved, do this:

1. Extract mission calculation into one shared module.
2. Introduce design tokens + component primitives.
3. Add a11y baseline (focus, live regions, semantic grouping).
4. Keep deployment-agnostic PWA paths.

This one track resolves most quality, efficiency, and future-proofing concerns without a patchwork of tactical fixes.

---

## Proofreading Notes

Current product language is already concise and operationally clear. Maintain these conventions:

- Keep event labels short and standardized (`T/O`, `FDP End`, `Crew Rest`).
- Keep warning language action-oriented (“adjust Crew Brief in Setup”).
- Keep timezone suffixes explicit (`L`, `Z`) for mission comms clarity.

