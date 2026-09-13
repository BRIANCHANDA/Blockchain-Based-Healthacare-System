Empty / loading / error placeholder for any data-driven screen.

```jsx
<EmptyState icon="send" title="No referrals yet" body="When your doctor refers you, it'll appear here." />
<EmptyState mode="loading" title="Loading records…" />
<EmptyState mode="error" title="Couldn't load" body="Check your connection and try again." action={<Button>Retry</Button>} />
```

`mode`: empty (default) | loading (pulsing) | error (coral).
