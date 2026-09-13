Primary bottom navigation: four sections split around a central floating appointment action. 64px tall, safe-area aware, badge support.

```jsx
<TabBar
  active="access"
  tabs={[
    { id:'records', label:'Records', icon:'file-text' },
    { id:'access', label:'Access', icon:'shield-check', badge:2 },
    { id:'history', label:'History', icon:'activity' },
    { id:'referrals', label:'Referrals', icon:'send' },
  ]}
  onSelect={setTab}
  onFab={bookAppointment}
/>
```

Defaults to Records / Access / History / Referrals when `tabs` is omitted. `onFab` fires the center action.
