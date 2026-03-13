// HealthChain Zambia — Design System
export const Colors = {
    // Primary greens
    primary: '#0A6640',
    primaryDark: '#064D30',
    primaryLight: '#0D8050',
    primaryMuted: '#E6F4EE',
    primaryBorder: '#B3D9C8',

    // Accent — warm gold
    accent: '#C9952A',
    accentLight: '#FDF3DC',
    accentDark: '#A07820',

    // Neutrals
    surface: '#FFFFFF',
    surfaceRaised: '#F7FAF8',
    background: '#F0F5F2',
    border: '#DDE8E2',
    borderLight: '#EEF4F1',

    // Text
    textPrimary: '#0D1F17',
    textSecondary: '#4A6357',
    textMuted: '#8AA89C',
    textOnPrimary: '#FFFFFF',

    // Status
    success: '#0A6640',
    warning: '#C9952A',
    danger: '#C0392B',
    dangerLight: '#FDECEA',
    info: '#1A6B8A',
    infoLight: '#E3F2F8',

    // Tab bar
    tabActive: '#0A6640',
    tabInactive: '#8AA89C',
    tabBackground: '#FFFFFF',
};

export const Typography = {
    // Use system fonts that feel premium
    displayLarge: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    displayMedium: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
    headingLarge: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
    headingMedium: { fontSize: 16, fontWeight: '600' as const },
    headingSmall: { fontSize: 14, fontWeight: '600' as const },
    bodyLarge: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
    bodyMedium: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
    bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },
    label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8 },
    caption: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5 },
};

export const Spacing = {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const Radius = {
    sm: 6, md: 10, lg: 14, xl: 18, full: 999,
};

export const Shadow = {
    card: {
        shadowColor: '#0A6640',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    strong: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
};