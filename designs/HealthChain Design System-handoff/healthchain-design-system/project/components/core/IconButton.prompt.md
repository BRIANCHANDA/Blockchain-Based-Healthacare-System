Square icon-only button for headers and toolbars. Always pass `label` (accessible name).

```jsx
<IconButton icon="bell" label="Alerts" badge />
<IconButton icon="arrow-left" label="Back" variant="surface" onClick={goBack} />
```

`variant`: ghost | surface | tint. `badge` shows an unread dot. 44px touch target.
