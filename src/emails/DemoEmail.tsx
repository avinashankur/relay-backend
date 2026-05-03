import { Text, Section, Row, Column, Hr } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface DemoEmailProps {
  recipientEmail: string;
}

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function DemoEmail({ recipientEmail }: DemoEmailProps) {
  return (
    <Layout previewText="[TEST] Demo email from Relay">
      {/* Label */}
      <Text style={labelStyle}>Test email</Text>

      {/* Heading */}
      <Text style={headingStyle}>Delivery pipeline check</Text>

      {/* Intro */}
      <Text style={bodyStyle}>
        This email was sent to{" "}
        <span style={{ color: "#09090b", fontWeight: "600" }}>
          {recipientEmail}
        </span>{" "}
        to confirm that the email delivery pipeline is working correctly. No
        action is required — this is not a real transactional email.
      </Text>

      {/* Divider */}
      <Hr style={hrStyle} />

      {/* What's being tested */}
      <Text style={sectionHeadingStyle}>What's being tested</Text>
      <Text style={bodyStyle}>
        This message exercises the full email path: job enqueue → BullMQ worker
        → Resend API → inbox delivery. If you're reading this, all three stages
        completed successfully.
      </Text>

      {/* Meta info block */}
      <Section style={metaBoxStyle}>
        <Row>
          <Column style={metaLabelColStyle}>
            <Text style={metaLabelStyle}>Recipient</Text>
          </Column>
          <Column>
            <Text style={metaValueStyle}>{recipientEmail}</Text>
          </Column>
        </Row>
        <Row>
          <Column style={metaLabelColStyle}>
            <Text style={metaLabelStyle}>Job type</Text>
          </Column>
          <Column>
            <Text style={metaValueStyle}>send-demo</Text>
          </Column>
        </Row>
        <Row>
          <Column style={metaLabelColStyle}>
            <Text style={metaLabelStyle}>Queue</Text>
          </Column>
          <Column>
            <Text style={metaValueStyle}>email (BullMQ)</Text>
          </Column>
        </Row>
        <Row>
          <Column style={metaLabelColStyle}>
            <Text style={metaLabelStyle}>Sent via</Text>
          </Column>
          <Column>
            <Text style={metaValueStyle}>Resend</Text>
          </Column>
        </Row>
      </Section>

      {/* Divider */}
      <Hr style={hrStyle} />

      {/* Button section */}
      <Text style={sectionHeadingStyle}>Button component</Text>
      <Text style={bodyStyle}>
        The button below is a no-op link used to verify that the{" "}
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#09090b",
          }}
        >
          Button
        </span>{" "}
        component renders correctly and the call-to-action layout looks right in
        your email client.
      </Text>

      <Section style={{ paddingBottom: "8px" }}>
        <Button href="#">Test primary button</Button>
      </Section>

      {/* Divider */}
      <Hr style={hrStyle} />

      {/* Disclaimer */}
      <Text style={disclaimerStyle}>
        If you received this by mistake, you can safely ignore it. This email is
        only used to verify transactional email delivery and is never sent to
        real users.
      </Text>
    </Layout>
  );
}

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
  color: "#09090b",
  letterSpacing: "-0.01em",
  margin: "0 0 6px 0",
};

const bodyStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "14px",
  color: "#52525b",
  lineHeight: "1.65",
  margin: "0 0 20px 0",
};

const hrStyle: React.CSSProperties = {
  borderTop: "1px solid #f4f4f5",
  borderBottom: "none",
  borderLeft: "none",
  borderRight: "none",
  margin: "24px 0",
};

const metaBoxStyle: React.CSSProperties = {
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  border: "1px solid #f4f4f5",
  paddingTop: "4px",
  paddingBottom: "4px",
  paddingLeft: "16px",
  paddingRight: "16px",
  marginBottom: "20px",
};

const metaLabelColStyle: React.CSSProperties = {
  width: "100px",
};

const metaLabelStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "12px",
  fontWeight: "500",
  color: "#a1a1aa",
  margin: "6px 0",
};

const metaValueStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "12px",
  color: "#09090b",
  margin: "6px 0",
};

const disclaimerStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "12px",
  color: "#a1a1aa",
  lineHeight: "1.6",
  margin: "0",
};

export default DemoEmail;
