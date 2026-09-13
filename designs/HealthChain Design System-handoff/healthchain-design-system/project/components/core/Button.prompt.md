Primary action button — green primary for the one main action on a screen; secondary/tint/ghost for supporting actions; destructive (coral) for revoke/deny.

```jsx
<Button variant="primary" iconLeft="shield-check" fullWidth onClick={approve}>Approve access</Button>
<Button variant="secondary" size="md">Not now</Button>
<Button variant="destructive" iconLeft="x">Deny</Button>
```

Variants: `primary` · `secondary` · `ghost` · `tint` · `destructive`. Sizes `sm | md | lg`. Props: `iconLeft`/`iconRight` (icon name), `loading`, `disabled`, `fullWidth`. Keep one primary button per screen.
