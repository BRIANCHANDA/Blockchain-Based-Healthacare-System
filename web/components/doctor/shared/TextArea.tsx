export function TextArea({ value, onChange, placeholder, rows = 3 }: any) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none
        focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white resize-none placeholder:text-gray-400 transition-all"
    />
  );
}
