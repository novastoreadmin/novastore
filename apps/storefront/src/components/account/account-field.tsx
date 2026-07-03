"use client";

// Text input styled like the checkout form fields, for the login/register pages.
export function AccountField({
  label,
  type = "text",
  placeholder,
  required,
  name,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  name: string;
  value: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium text-text-secondary mb-2"
      >
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-4 rounded-xl bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
      />
    </div>
  );
}
