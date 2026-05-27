export function SectionCard({ title, children, action }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
