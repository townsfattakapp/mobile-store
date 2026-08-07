import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#1d1d1f]">
            {label}
          </label>
        )}
        <input
          type={type}
          className={`flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-[#6e6e73] ${
            error ? "border-red-500 focus:ring-red-500" : ""
          } ${className}`}
          ref={ref}
          {...props}
        />
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
