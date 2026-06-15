// MedLink · Design System tokens (translated from HealthChain DS handoff)
// Source of truth: designs/HealthChain Design System-handoff/

// ── Color palette ─────────────────────────────────────────────────────────────
export const Colors = {
  // Brand green — trust, vitality, "granted/healthy" state
  green900: "#064E3B",
  green800: "#047857", // deep — pressed states, dark accents
  green700: "#059669", // PRIMARY brand green
  green600: "#10B981",
  green300: "#6EE7B7",
  green200: "#A7F3D0",
  green100: "#D1FAE5", // light — selected chips, soft fills
  green050: "#ECFDF5", // ghost — tint backgrounds, hover wash

  // Ink (text)
  ink900: "#0A0E1A",  // primary text
  ink700: "#1F2733",
  ink500: "#4B5563",  // soft / secondary text
  ink400: "#9CA3AF",  // muted / placeholder
  ink300: "#D1D5DB",  // subtle / disabled

  // Surfaces & lines
  white: "#FFFFFF",
  surfaceApp: "#FAFAFB",
  surfaceSunken: "#F4F4F6",
  border200: "#E5E7EB",
  border100: "#F0F1F3",

  // Semantic hues
  coral600: "#E13D3D",
  coral500: "#FF5757",
  coral100: "#FFE5E5",
  coral050: "#FFF1F1",

  amber600: "#B45309",
  amber500: "#F59E0B",
  amber100: "#FEF3C7",
  amber050: "#FFFBEB",

  blue600: "#2563EB",
  blue500: "#3B82F6",
  blue100: "#DBEAFE",
  blue050: "#EFF6FF",

  violet600: "#7C3AED",
  violet500: "#8B5CF6",
  violet100: "#EDE9FE",
  violet050: "#F5F3FF",

  // Lock / away-record neutral
  slate500: "#64748B",
  slate100: "#F1F5F9",
};

// ── Semantic aliases (prefer these in components) ─────────────────────────────
export const C = {
  // Brand
  brand:        Colors.green700,
  brandDeep:    Colors.green800,
  brandTint:    Colors.green050,
  brandFill:    Colors.green100,
  onBrand:      Colors.white,

  // Text
  textPrimary:   Colors.ink900,
  textSecondary: Colors.ink500,
  textMuted:     Colors.ink400,
  textDisabled:  Colors.ink300,
  textLink:      Colors.green700,

  // Surfaces
  surfaceCard:   Colors.white,
  surfaceBg:     Colors.surfaceApp,
  surfaceInset:  Colors.surfaceSunken,

  // Borders
  border:        Colors.border200,
  borderFaint:   Colors.border100,

  // Semantic status
  critical:      Colors.coral500,
  criticalInk:   Colors.coral600,
  criticalTint:  Colors.coral100,

  urgent:        Colors.amber500,
  urgentInk:     Colors.amber600,
  urgentTint:    Colors.amber100,

  info:          Colors.blue500,
  infoInk:       Colors.blue600,
  infoTint:      Colors.blue100,

  accent:        Colors.violet500,
  accentInk:     Colors.violet600,
  accentTint:    Colors.violet100,

  success:       Colors.green700,
  successInk:    Colors.green800,
  successTint:   Colors.green100,

  locked:        Colors.slate500,
  lockedTint:    Colors.slate100,

  // Shortcuts (backwards-compat with old theme keys)
  primary:       Colors.green700,
  primaryDark:   Colors.green800,
  primaryDeep:   Colors.green900,
  primaryLight:  Colors.green100,
  primaryGhost:  Colors.green050,

  coral:        Colors.coral500,
  coralLight:   Colors.coral100,
  amber:        Colors.amber500,
  amberLight:   Colors.amber100,
  blue:         Colors.blue500,
  blueLight:    Colors.blue100,
  violet:       Colors.violet500,
  violetLight:  Colors.violet100,

  ink:          Colors.ink900,
  inkSoft:      Colors.ink500,
  inkMuted:     Colors.ink400,
  inkSubtle:    Colors.ink300,

  bg:           Colors.surfaceApp,
  bgAlt:        Colors.surfaceSunken,
  card:         Colors.white,
  cardBorder:   Colors.border200,
  divider:      Colors.border100,
};

// ── Spacing (8pt grid, 4px half-steps) ───────────────────────────────────────
export const Spacing = {
  sp1:  4,
  sp2:  8,
  sp3:  12,
  sp4:  16,
  sp5:  20,
  sp6:  24,
  sp8:  32,
  sp10: 40,
  sp12: 48,
  sp16: 64,
  screenPad: 20,
  touchMin:  44,
  tabBarH:   64,
};

// ── Radii ─────────────────────────────────────────────────────────────────────
export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  pill: 999,
};

// ── Elevation (translates to RN shadow + elevation) ───────────────────────────
export const Shadow = {
  elev1: {
    shadowColor: "#0A0E1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  elev2: {
    shadowColor: "#0A0E1A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  elev3: {
    shadowColor: "#0A0E1A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.10,
    shadowRadius: 32,
    elevation: 8,
  },
  elevBrand: {
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
};

// ── Typography scale ──────────────────────────────────────────────────────────
export const Typography = {
  display:  { fontSize: 34, fontWeight: "600" as const, lineHeight: 39 },
  h1:       { fontSize: 26, fontWeight: "700" as const, lineHeight: 30, letterSpacing: -0.4 },
  h2:       { fontSize: 21, fontWeight: "600" as const, lineHeight: 27, letterSpacing: -0.3 },
  h3:       { fontSize: 18, fontWeight: "600" as const, lineHeight: 23, letterSpacing: -0.2 },
  bodyLg:   { fontSize: 17, fontWeight: "400" as const, lineHeight: 26 },
  body:     { fontSize: 15, fontWeight: "400" as const, lineHeight: 23 },
  meta:     { fontSize: 13, fontWeight: "500" as const, lineHeight: 17 },
  label:    { fontSize: 11, fontWeight: "600" as const, lineHeight: 11 },
  xs:       { fontSize: 11, fontWeight: "600" as const, lineHeight: 11 },
};
