import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleRecord({ title, subtitle, children, onOpen }: any) {
  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    const newOpen = !open;
    if (newOpen && onOpen) onOpen();
    setOpen(newOpen);
  };
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {open ? (
          <ChevronUp size={15} className="text-gray-400" />
        ) : (
          <ChevronDown size={15} className="text-gray-400" />
        )}
      </button>
      {open && <div className="p-4 border-t border-gray-100">{children}</div>}
    </div>
  );
}
export default CollapsibleRecord;
