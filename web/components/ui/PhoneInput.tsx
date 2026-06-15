"use client";
import { useState, useEffect, useRef } from "react";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

function parseInitial(value: string): { code: string; digits: string } {
  if (!value) return { code: "+260", digits: "" };
  if (value.startsWith("+")) {
    const allDigits = value.slice(1).replace(/\D/g, "");
    if (allDigits.length > 9) {
      // Assume last 9 digits are the local number; everything before is the country code
      const codeDigits = allDigits.slice(0, allDigits.length - 9);
      return { code: `+${codeDigits}`, digits: allDigits.slice(-9) };
    }
    return { code: "+260", digits: allDigits.slice(0, 9) };
  }
  return { code: "+260", digits: value.replace(/\D/g, "").slice(0, 9) };
}

export function PhoneInput({ value, onChange, error }: PhoneInputProps) {
  const [code, setCode] = useState(() => parseInitial(value).code);
  const [digits, setDigits] = useState(() => parseInitial(value).digits);

  // Track what we last emitted so we can ignore our own updates coming back as `value`
  const lastEmitted = useRef(code + digits);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      const parsed = parseInitial(value);
      setCode(parsed.code);
      setDigits(parsed.digits);
      lastEmitted.current = value;
    }
  }, [value]);

  const emit = (newCode: string, newDigits: string) => {
    const combined = newCode + newDigits;
    lastEmitted.current = combined;
    onChange(combined);
  };

  const handleCodeChange = (raw: string) => {
    const newCode = "+" + raw.replace(/\D/g, "").slice(0, 4);
    setCode(newCode);
    emit(newCode, digits);
  };

  const handleDigitsChange = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 9);
    setDigits(d);
    emit(code, d);
  };

  const ringClass = error
    ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
    : "border-gray-200 focus:border-green-600 focus:ring-green-600/10";

  return (
    <div className="flex">
      <input
        type="text"
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        maxLength={5}
        placeholder="+260"
        className={`w-[4.5rem] shrink-0 px-2.5 py-2.5 rounded-l-xl border border-r-0 bg-gray-100 text-sm text-center font-mono outline-none focus:ring-2 transition-all ${ringClass}`}
      />
      <input
        type="text"
        value={digits}
        onChange={(e) => handleDigitsChange(e.target.value)}
        placeholder="977 123 456"
        maxLength={9}
        className={`flex-1 px-3.5 py-2.5 rounded-r-xl border bg-gray-50 text-sm outline-none focus:bg-white focus:ring-2 transition-all ${ringClass}`}
      />
    </div>
  );
}
