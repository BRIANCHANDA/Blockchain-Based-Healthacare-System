Multi-select chip for access permissions. Tap to toggle, or render read-only as a grant summary.

```jsx
<PermissionChip scope="vitals" selected={has} onToggle={toggle} />
<PermissionChip scope="lab-results" readOnly selected />
```

`scope`: visits · vitals · diagnoses · prescriptions · lab-results · imaging. `readOnly` for static summaries (no toggle).
