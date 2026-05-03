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
  ip?: string;
  userAgent?: string;
  revokeUrl?: string;
  scheduledAt?: Date;
}

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const ALERT_COPY: Record<
  AlertType,
  { label: string; heading: string; body: string; severity: "high" | "medium" }
> = {
  token_reuse: {
    label: "Security alert",
    heading: "Suspicious session activity detected",
    body: "We detected that a sign-in token for your account was used more than once. This may indicate your session was stolen. As a precaution, we have immediately revoked all active sessions on your account.",
    severity: "high",
  },
  suspicious_login: {
    label: "Account notice",
    heading: "New sign-in to your account",
    body: "We detected a new sign-in to your account from an unrecognized device or location. If this was you, no action is needed. If you don't recognise this activity, secure your account immediately.",
    severity: "medium",
  },
  password_changed: {
    label: "Account notice",
    heading: "Your password has been changed",
    body: "Your account password was recently changed and all existing sessions have been revoked. If you made this change, no action is needed. If you did not, secure your account immediately.",
    severity: "medium",
  },
  account_deletion: {
    label: "Security alert",
    heading: "Your account is scheduled for deletion",
    body: "Your account has been scheduled for permanent deletion and all sessions have been revoked. If you did not request this, please contact support immediately to recover your account.",
    severity: "high",
  },
};

export function SecurityAlertEmail({
  alertType,
  ip,
  userAgent,
  revokeUrl,
  scheduledAt,
}: SecurityAlertEmailProps) {
  const copy = ALERT_COPY[alertType];
  const isHigh = copy.severity === "high";
  const hasDeviceInfo = ip || userAgent;

  return (
    <Layout previewText={`${copy.label}: ${copy.heading}`}>
      {/* Eyebrow label */}
      <Text style={isHigh ? highLabelStyle : mediumLabelStyle}>
        {copy.label}
      </Text>

      {/* Heading */}
      <Text style={headingStyle}>{copy.heading}</Text>

      {/* Body */}
      <Text style={bodyStyle}>{copy.body}</Text>

      {/* Scheduled deletion date */}
      {alertType === "account_deletion" && scheduledAt && (
        <>
          <Text style={sectionHeadingStyle}>Deletion date</Text>
          <Section style={deletionBoxStyle}>
            <Text style={deletionDateStyle}>
              {scheduledAt.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <Text style={deletionNoteStyle}>
              After this date, all your data will be permanently removed and
              cannot be recovered.
            </Text>
          </Section>
        </>
      )}

      {/* Activity details */}
      {hasDeviceInfo && (
        <>
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

      {/* CTA */}
      {revokeUrl && (
        <Section style={{ paddingBottom: "8px" }}>
          <Button href={revokeUrl} variant={isHigh ? "danger" : "primary"}>
            Review active sessions
          </Button>
        </Section>
      )}

      <Hr style={hrStyle} />

      {/* Disclaimer */}
      <Text style={disclaimerStyle}>
        {alertType !== "account_deletion"
          ? "If you recognise this activity, no action is needed. If you believe your account has been compromised, change your password immediately and contact support."
          : "If you did not request account deletion, contact support immediately at support@relay.dev."}
      </Text>
    </Layout>
  );
}

export default SecurityAlertEmail;

// ─── Styles ──────────────────────────────────────────────────────────────────

const baseLabelStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  margin: "0 0 14px 0",
};

const highLabelStyle: React.CSSProperties = {
  ...baseLabelStyle,
  color: "#dc2626",
};

const mediumLabelStyle: React.CSSProperties = {
  ...baseLabelStyle,
  color: "#d97706",
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

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "13px",
  fontWeight: "600",
  color: "#09090b",
  letterSpacing: "-0.01em",
  margin: "0 0 6px 0",
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

// Deletion box — red-tinted
const deletionBoxStyle: React.CSSProperties = {
  backgroundColor: "#fff5f5",
  borderRadius: "8px",
  borderTop: "2px solid #dc2626",
  borderRight: "1px solid #fecaca",
  borderBottom: "1px solid #fecaca",
  borderLeft: "1px solid #fecaca",
  paddingTop: "12px",
  paddingBottom: "12px",
  paddingLeft: "16px",
  paddingRight: "16px",
  marginBottom: "20px",
};

const deletionDateStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "14px",
  fontWeight: "700",
  color: "#dc2626",
  margin: "0 0 6px 0",
};

const deletionNoteStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "12px",
  color: "#52525b",
  lineHeight: "1.6",
  margin: "0",
};

// Meta / activity details box
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

const metaValueMonoStyle: React.CSSProperties = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: "12px",
  color: "#09090b",
  wordBreak: "break-all",
  margin: "6px 0",
};
