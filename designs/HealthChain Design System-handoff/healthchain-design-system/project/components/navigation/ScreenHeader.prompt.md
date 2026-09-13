Screen header — large title for top-level screens, back header for detail views. The `right` slot takes IconButtons, a TrustBadge or an Avatar.

```jsx
<ScreenHeader large title="Records" subtitle="Welcome back, Mwila" right={<IconButton icon="bell" label="Alerts" badge />} />
<ScreenHeader title="VIS-2026-A3F2" onBack={goBack} right={<TrustBadge kind="encrypted" size="sm" />} />
```

`onBack` renders the back arrow. `large` for the big top-level title.
