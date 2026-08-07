import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  isLoading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-black text-white hover:bg-neutral-800 focus:ring-black",
    secondary: "bg-neutral-100 text-[#1d1d1f] hover:bg-neutral-200 focus:ring-neutral-200",
    outline: "border border-neutral-300 text-[#1d1d1f] hover:bg-neutral-50 focus:ring-neutral-300",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600",
    ghost: "text-[#1d1d1f] hover:bg-neutral-100 focus:ring-neutral-100"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg"
  };

  const disabledStyles = (disabled || isLoading) ? "opacity-50 cursor-not-allowed pointer-events-none" : "";

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
