import { Button as EmailButton } from "@react-email/components";

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "danger";
}

// Note: Do not use tailwind or any external CSS framework here for better compatibility.
export function Button({ href, children, variant = "primary" }: ButtonProps) {
  return (
    <EmailButton
      href={href}
      style={variant === "primary" ? primaryStyle : dangerStyle}
    >
      {children}
    </EmailButton>
  );
}

const base: React.CSSProperties = {
  display: "inline-block",
  borderRadius: "8px",
  padding: "12px 28px",
  fontSize: "14px",
  fontWeight: "600",
  letterSpacing: "0.01em",
  textDecoration: "none",
  textAlign: "center",
  cursor: "pointer",
};

const primaryStyle: React.CSSProperties = {
  ...base,
  backgroundColor: "#09090b",
  color: "#ffffff",
};

const dangerStyle: React.CSSProperties = {
  ...base,
  backgroundColor: "#dc2626",
  color: "#ffffff",
};
