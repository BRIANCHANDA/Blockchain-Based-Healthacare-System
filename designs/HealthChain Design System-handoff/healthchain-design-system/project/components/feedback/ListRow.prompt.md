Tappable list row for settings, access grants and navigation. Group several inside a `Card` and divide with hairline borders.

```jsx
<ListRow icon="lock" iconTone="brand" title="Change password" chevron onClick={open} />
<ListRow icon="bell" title="Notifications" right="On" chevron onClick={...} />
<ListRow icon="log-out" title="Sign out" destructive onClick={...} />
```

`iconTone`: neutral|brand|info|accent|critical. `destructive` for coral rows. `right` takes a value or StatusPill.
