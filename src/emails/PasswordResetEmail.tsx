import { Text, Section, Hr } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface PasswordResetEmailProps {
  resetUrl: string;
}

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <Layout previewText="Reset your Relay password — link expires in 30 minutes">
      <Text style={labelStyle}>Password reset</Text>
      <Text style={headingStyle}>Reset your password</Text>

      <Text style={bodyStyle}>
        We received a request to reset your password. Click the button below to
        choose a new one. This link expires in{" "}
        <span style={emphasisStyle}>30 minutes</span> and can only be used once.
      </Text>

      <Section style={{ paddingBottom: "8px" }}>
        <Button href={resetUrl}>Reset password</Button>
      </Section>

      <Hr style={hrStyle} />

      <Text style={disclaimerStyle}>
        If you didn't request a password reset, you can safely ignore this
        email. Your password will not be changed.{" "}
        <span style={fallbackLinkStyle}>{resetUrl}</span>
      </Text>
    </Layout>
  );
}

export default PasswordResetEmail;

const labelStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#a1a1aa",
  margin: "0 0 14px 0",
};

const headingStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "22px",
  fontWeight: "700",
  letterSpacing: "-0.025em",
  color: "#09090b",
  lineHeight: "1.3",
  margin: "0 0 12px 0",
};

const bodyStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "14px",
  color: "#52525b",
  lineHeight: "1.65",
  margin: "0 0 20px 0",
};

const emphasisStyle: React.CSSProperties = {
  color: "#09090b",
  fontWeight: "600",
};

const hrStyle: React.CSSProperties = {
  borderTop: "1px solid #f4f4f5",
  borderBottom: "none",
  borderLeft: "none",
  borderRight: "none",
  margin: "24px 0",
};

const disclaimerStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "12px",
  color: "#a1a1aa",
  lineHeight: "1.6",
  margin: "0",
};

const fallbackLinkStyle: React.CSSProperties = {
  display: "block",
  color: "#a1a1aa",
  wordBreak: "break-all",
  marginTop: "8px",
};
