"use client";

import { useEffect, useState } from "react";

// Server-rendered defaults like `new Date().toISOString().slice(0, 10)`
// reflect the server's UTC clock — that's a day off for half the planet.
// This client component fills the date input with the *browser's* local
// today (and optional offset in days) so the customer's "today" is always
// the user's local "today".
export function LocalDateInput({
  name,
  offsetDays = 0,
  className,
  required,
  ...rest
}: {
  name: string;
  offsetDays?: number;
  className?: string;
  required?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "defaultValue">) {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setValue(`${y}-${m}-${dd}`);
  }, [offsetDays]);

  return (
    <input
      type="date"
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={className}
      required={required}
      {...rest}
    />
  );
}
