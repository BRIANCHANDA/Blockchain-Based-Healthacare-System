Labeled text field. Pass `type="password"` for a built-in show/hide toggle; `error` turns it coral with an alert glyph. 52px touch target.

```jsx
<Input label="National ID" icon="fingerprint" value={nid} onChange={e=>setNid(e.target.value)} />
<Input label="Password" type="password" icon="lock" value={pw} onChange={...} error="Invalid credentials" />
```

Props: `label`, `icon`, `error`, `helper`, plus all native input attributes (`placeholder`, `inputMode`, `maxLength`…).
