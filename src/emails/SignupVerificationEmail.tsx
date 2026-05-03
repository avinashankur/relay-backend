import { Text, Section, Hr } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface SignupVerificationEmailProps {
  verificationUrl: string;
  recipientEmail: string;
}

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function SignupVerificationEmail({
  verificationUrl,
  recipientEmail,
}: SignupVerificationEmailProps) {
  return (
    <Layout previewText="Verify your email address to finish setting up Relay">
      <Text style={labelStyle}>Welcome to Relay</Text>
      <Text style={headingStyle}>Verify your email address</Text>

      <Text style={bodyStyle}>
        Thanks for signing up. Verify{" "}
        <span style={emphasisStyle}>{recipientEmail}</span> to activate your
        Relay account. This link expires in{" "}
        <span style={emphasisStyle}>24 hours</span>.
      </Text>

      <Section style={buttonSectionStyle}>
        <Button href={verificationUrl}>Verify email</Button>
      </Section>

      <Hr style={hrStyle} />

      <Text style={sectionHeadingStyle}>Having trouble?</Text>
      <Text style={bodyStyle}>
        Copy and paste this verification link into your browser. For your
        protection, the link can only be used once.
        <span style={fallbackLinkStyle}>{verificationUrl}</span>
      </Text>

      <Hr style={hrStyle} />

      <Text style={disclaimerStyle}>
        If you did not create a Relay account, you can safely ignore this email.
        Relay will not activate an account unless this address is verified.
      </Text>
    </Layout>
  );
}

export default SignupVerificationEmail;

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

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "13px",
  fontWeight: "600",
  letterSpacing: "-0.01em",
  color: "#09090b",
  margin: "0 0 6px 0",
};

const bodyStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "14px",
  fontWeight: "400",
  color: "#52525b",
  lineHeight: "1.65",
  margin: "0 0 20px 0",
};

const emphasisStyle: React.CSSProperties = {
  color: "#09090b",
  fontWeight: "600",
};

const buttonSectionStyle: React.CSSProperties = {
  fontFamily: sans,
  paddingBottom: "8px",
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
  fontWeight: "400",
  color: "#a1a1aa",
  lineHeight: "1.6",
  margin: "0",
};

const fallbackLinkStyle: React.CSSProperties = {
  display: "block",
  fontFamily: sans,
  color: "#09090b",
  wordBreak: "break-all",
  marginTop: "8px",
};
