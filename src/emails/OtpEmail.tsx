import { Text, Section, Hr } from "@react-email/components";
import { Layout } from "./components/Layout";

interface OtpEmailProps {
  code: string;
  recipientEmail: string;
}

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function OtpEmail({ code, recipientEmail }: OtpEmailProps) {
  const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;

  return (
    <Layout previewText={`${formattedCode} is your Relay verification code`}>
      <Text style={labelStyle}>Verification code</Text>
      <Text style={headingStyle}>Your one-time code</Text>

      <Text style={bodyStyle}>
        Use this code for <span style={emphasisStyle}>{recipientEmail}</span> to
        finish signing in to Relay. It expires in{" "}
        <span style={emphasisStyle}>10 minutes</span> and can only be used once.
      </Text>

      <Section style={codeContainerStyle}>
        <Text style={codeStyle}>{formattedCode}</Text>
      </Section>

      <Hr style={hrStyle} />

      <Text style={sectionHeadingStyle}>Code not working?</Text>
      <Text style={bodyStyle}>
        Request a new code from the sign-in screen. For your protection, Relay
        locks this verification attempt after{" "}
        <span style={emphasisStyle}>5 incorrect tries</span>.
      </Text>

      <Hr style={hrStyle} />

      <Text style={disclaimerStyle}>
        If you did not request this code, you can safely ignore this email.
        Relay will not sign you in without the code.
      </Text>
    </Layout>
  );
}

export default OtpEmail;

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

const codeContainerStyle: React.CSSProperties = {
  fontFamily: sans,
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  border: "1px solid #f4f4f5",
  textAlign: "center",
  paddingTop: "20px",
  paddingBottom: "20px",
  marginBottom: "20px",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: "36px",
  fontWeight: "700",
  letterSpacing: "8px",
  color: "#09090b",
  margin: "0",
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
