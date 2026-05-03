import { Text, Section, Hr } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface MagicLinkEmailProps {
  magicLinkUrl: string;
  recipientEmail: string;
}

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function MagicLinkEmail({
  magicLinkUrl,
  recipientEmail,
}: MagicLinkEmailProps) {
  return (
    <Layout previewText="Use your Relay sign-in link within 15 minutes">
      <Text style={labelStyle}>Secure sign in</Text>
      <Text style={headingStyle}>Sign in to Relay</Text>

      <Text style={bodyStyle}>
        We received a request to sign in to Relay for{" "}
        <span style={emphasisStyle}>{recipientEmail}</span>. Use the button
        below to continue. This link is single-use and expires in{" "}
        <span style={emphasisStyle}>15 minutes</span>.
      </Text>

      <Section style={buttonSectionStyle}>
        <Button href={magicLinkUrl}>Sign in to Relay</Button>
      </Section>

      <Hr style={hrStyle} />

      <Text style={sectionHeadingStyle}>Having trouble?</Text>
      <Text style={bodyStyle}>
        Copy and paste this secure link into your browser. For your protection,
        it will stop working after it is used or when it expires.
        <span style={fallbackLinkStyle}>{magicLinkUrl}</span>
      </Text>

      <Hr style={hrStyle} />

      <Text style={disclaimerStyle}>
        If you did not request this sign-in link, you can safely ignore this
        email. Relay will not sign you in unless this link is opened.
      </Text>
    </Layout>
  );
}

export default MagicLinkEmail;

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
