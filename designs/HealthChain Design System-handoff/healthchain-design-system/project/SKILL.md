---
name: healthchain-design
description: Use this skill to generate well-branded interfaces and assets for HealthChain (a blockchain-secured patient medical-records mobile app for Zambian hospitals), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick map
- `readme.md` — product context, content + visual foundations, iconography, manifest. **Read this first.**
- `styles.css` — link this one file to get all tokens + fonts. Use the semantic aliases (`--brand`, `--text-primary`, `--surface-card`, `--critical`, etc.).
- `tokens/` — colors, typography, spacing/radii/elevation, fonts.
- `components/` — React primitives. Load the compiled `_ds_bundle.js` and read them from `window.<Namespace>` (run the design-system check to get the namespace), e.g. `const { Button, StatusPill, LockState, TabBar } = window.<Namespace>`.
- `ui_kits/patient-app/` — full interactive recreation of all 8 screens; the best reference for composition.
- `assets/logo-mark.svg` — the brand mark.

## Non-negotiables
- Brand is **“HealthChain”** — never abbreviated, never “MedLink”. Patients sign in with **National ID**, not email.
- Tone: calm, trustworthy, warm; address the patient as **“you”**; sentence case; **no emoji**.
- One status/priority vocabulary (use `StatusPill` / `PriorityPill`). Core metaphor is `locked → request → pending → granted` (`LockState`).
- Safety-critical info (blood type, allergies, abnormal labs, critical priority) = **color + icon + position**, never color alone. WCAG AA, ≥44px touch targets.
- Restrained, RN-friendly visuals: flat surfaces, low-spread shadows, no heavy blur, no purple gradients, minimal imagery (low bandwidth).
