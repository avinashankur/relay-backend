import { Text, Section, Row, Column, Hr } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

type AlertType =
  | "token_reuse"
  | "suspicious_login"
  | "password_changed"
  | "account_deletion";

interface SecurityAlertEmailProps {
  alertType: AlertType;
  recipientEmail: string;
  ip?: string;
  userAgent?: string;
  revokeUrl?: string;
  scheduledAt?: Date;
}

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const ALERT_COPY: Record<
  AlertType,
  {
    label: string;
    heading: string;
    intro: string;
    action: string;
    cta: string;
    disclaimer: string;
    danger: boolean;
  }
> = {
  token_reuse: {
    label: "Security alert",
    heading: "Suspicious session activity detected",
    intro:
      "A sign-in token for your account appears to have been used more than once. Relay revoked active sessions as a precaution.",
    action:
      "Review your active sessions and sign in again from a trusted device. Change your password if any activity looks unfamiliar.",
    cta: "Review sessions",
    disclaimer:
      "If you recognize this activity, no further action is needed after you sign in again.",
    danger: true,
  },
  suspicious_login: {
    label: "Account notice",
    heading: "New sign-in detected",
    intro:
      "Relay detected a new sign-in from a device or location we have not seen recently.",
    action:
      "Review your sessions if this was not you. You can revoke unfamiliar sessions from your account settings.",
    cta: "Review sessions",
    disclaimer:
      "If this was you, no action is needed. If you do not recognize it, secure your account immediately.",
    danger: false,
  },
  password_changed: {
    label: "Account notice",
    heading: "Your password was changed",
    intro:
      "The password for your Relay account was changed and existing sessions were revoked.",
    action:
      "Review your sessions and reset your password again if you did not make this change.",
    cta: "Review sessions",
    disclaimer:
      "If you made this change, no action is needed. If you did not, secure your account immediately.",
    danger: false,
  },
  account_deletion: {
    label: "Security alert",
    heading: "Account deletion scheduled",
    intro:
      "Your Relay account has been scheduled for permanent deletion and active sessions were revoked.",
    action:
      "Contact support immediately if you did not request this deletion. After the scheduled date, account data cannot be recovered.",
    cta: "Review account",
    disclaimer:
      "If you did not request account deletion, contact support immediately at support@relay.dev.",
    danger: true,
  },
};

export function SecurityAlertEmail({
  alertType,
  recipientEmail,
  ip,
  userAgent,
  revokeUrl,
  scheduledAt,
}: SecurityAlertEmailProps) {
  const copy = ALERT_COPY[alertType];
  const hasDeviceInfo = ip || userAgent;

  return (
    <Layout previewText={`${copy.label}: ${copy.heading}`}>
      <Text style={labelStyle}>{copy.label}</Text>
      <Text style={headingStyle}>{copy.heading}</Text>

      <Text style={bodyStyle}>
        This notice is for <span style={emphasisStyle}>{recipientEmail}</span>.{" "}
        {copy.intro}
      </Text>

      {alertType === "account_deletion" && scheduledAt && (
        <>
          <Hr style={hrStyle} />
          <Text style={sectionHeadingStyle}>Deletion schedule</Text>
          <Section style={metaBoxStyle}>
            <Row>
              <Column style={metaLabelColStyle}>
                <Text style={metaLabelStyle}>Scheduled for</Text>
              </Column>
              <Column>
                <Text style={metaValueStyle}>
                  {scheduledAt.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </Column>
            </Row>
          </Section>
        </>
      )}

      {hasDeviceInfo && (
        <>
          <Hr style={hrStyle} />
          <Text style={sectionHeadingStyle}>Activity details</Text>
          <Section style={metaBoxStyle}>
            {ip && (
              <Row>
                <Column style={metaLabelColStyle}>
                  <Text style={metaLabelStyle}>IP address</Text>
                </Column>
                <Column>
                  <Text style={metaValueMonoStyle}>{ip}</Text>
                </Column>
              </Row>
            )}
            {userAgent && (
              <Row>
                <Column style={metaLabelColStyle}>
                  <Text style={metaLabelStyle}>Device</Text>
                </Column>
                <Column>
                  <Text style={metaValueMonoStyle}>{userAgent}</Text>
                </Column>
              </Row>
            )}
          </Section>
        </>
      )}

      <Hr style={hrStyle} />

      <Text style={sectionHeadingStyle}>Recommended action</Text>
      <Text style={bodyStyle}>{copy.action}</Text>

      {revokeUrl && (
        <Section style={buttonSectionStyle}>
          <Button href={revokeUrl} variant={copy.danger ? "danger" : "primary"}>
            {copy.cta}
          </Button>
        </Section>
      )}

      {revokeUrl && (
        <>
          <Hr style={hrStyle} />
          <Text style={sectionHeadingStyle}>Having trouble?</Text>
          <Text style={bodyStyle}>
            Copy and paste this secure link into your browser.
            <span style={fallbackLinkStyle}>{revokeUrl}</span>
          </Text>
        </>
      )}

      <Hr style={hrStyle} />

      <Text style={disclaimerStyle}>{copy.disclaimer}</Text>
    </Layout>
  );
}

export default SecurityAlertEmail;

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

const metaBoxStyle: React.CSSProperties = {
  fontFamily: sans,
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
  fontWeight: "400",
  color: "#09090b",
  margin: "6px 0",
};

const metaValueMonoStyle: React.CSSProperties = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: "12px",
  fontWeight: "400",
  color: "#09090b",
  wordBreak: "break-all",
  margin: "6px 0",
};

const fallbackLinkStyle: React.CSSProperties = {
  display: "block",
  fontFamily: sans,
  color: "#09090b",
  wordBreak: "break-all",
  marginTop: "8px",
};
