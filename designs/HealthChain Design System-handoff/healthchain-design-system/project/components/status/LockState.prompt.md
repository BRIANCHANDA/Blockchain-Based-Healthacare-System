The product's core access metaphor as a tactile state tile: locked → request → pending → granted (or denied). Use for away-institution records and access flows.

```jsx
<LockState phase="locked" onAction={sendRequest} />
<LockState phase="pending" />
<LockState phase="granted" />
```

`phase`: locked | pending | granted | denied. Pass `onAction` to render the CTA (e.g. "Request access"). Override `title`/`body`/`actionLabel` as needed.
