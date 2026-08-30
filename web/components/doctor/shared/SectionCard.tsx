/** Titled block with an optional right-aligned action. Not a card surface. */
export function SectionCard({ title, children, action }: any) {
  return (
    <div>
      <div
        className="flex items-center justify-between"
        style={{ gap: 12, marginBottom: 12 }}
      >
        <h3
          style={{
            margin: 0,
            font: "700 13.5px/1 var(--font-sans)",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}
