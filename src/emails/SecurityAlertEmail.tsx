import { Text, Section, Row, Column } from "@react-email/components";
import * as React from "react";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

type AlertType = "token_reuse" | "suspicious_login" | "password_changed";

interface SecurityAlertEmailProps {
  alertType: AlertType;
  ip?: string;
  userAgent?: string;
  revokeUrl?: string;
}

const ALERT_COPY: Record<
  AlertType,
  { subject: string; body: string; severity: "high" | "medium" }
> = {
  token_reuse: {
    subject: "Security alert: suspicious session activity detected",
    body: "We detected that a sign-in token for your account was used more than once. This may indicate your session was stolen. As a precaution, we have immediately revoked all active sessions on your account.",
    severity: "high",
  },
  suspicious_login: {
    subject: "Security alert: new sign-in to your account",
    body: "We detected a new sign-in to your account from an unrecognized device or location. If this was you, no action is needed. If you don't recognise this activity, secure your account immediately.",
    severity: "medium",
  },
  password_changed: {
    subject: "Your password has been changed",
    body: "Your account password was recently changed. All existing sessions have been revoked. If you made this change, no action is needed. If you did not, secure your account immediately.",
    severity: "medium",
  },
};

export function SecurityAlertEmail({
  alertType,
  ip,
  userAgent,
  revokeUrl,
}: SecurityAlertEmailProps) {
  const copy = ALERT_COPY[alertType];
  const isHigh = copy.severity === "high";

  return (
    <Layout previewText={copy.subject}>
      <Section className="mb-4">
        <Text
          className="text-xs font-semibold uppercase tracking-widest m-0"
          style={isHigh ? highBadgeStyle : mediumBadgeStyle}
        >
          {isHigh ? "⚠ Security Alert" : "ℹ Account Notice"}
        </Text>
      </Section>

      <Text className="text-xl font-bold tracking-tight text-zinc-900 m-0 mb-3">
        {isHigh
          ? "Immediate action may be required"
          : "Account activity notice"}
      </Text>

      <Text className="text-sm text-zinc-600 leading-relaxed mt-0 mb-6">
        {copy.body}
      </Text>

      {/* Device details */}
      {(ip || userAgent) && (
        <Section className="bg-zinc-100 rounded-lg p-4 mb-6">
          <Text className="text-xs font-semibold uppercase tracking-widest text-zinc-400 m-0 mb-3">
            Activity details
          </Text>
          {ip && (
            <Row className="mb-2">
              <Column className="text-xs text-zinc-500 w-24">IP address</Column>
              {/* inline: font-family for monospace */}
              <Column
                className="text-xs text-zinc-900"
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  wordBreak: "break-all",
                }}
              >
                {ip}
              </Column>
            </Row>
          )}
          {userAgent && (
            <Row>
              <Column className="text-xs text-zinc-500 w-24">Device</Column>
              {/* inline: font-family for monospace */}
              <Column
                className="text-xs text-zinc-900"
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  wordBreak: "break-all",
                }}
              >
                {userAgent}
              </Column>
            </Row>
          )}
        </Section>
      )}

      {revokeUrl && (
        <Section className="mb-6">
          <Button href={revokeUrl} variant={isHigh ? "danger" : "primary"}>
            Review active sessions
          </Button>
        </Section>
      )}

      <Text className="text-xs text-zinc-500 leading-relaxed m-0">
        If you recognise this activity, no action is needed. If you believe your
        account has been compromised, change your password immediately and
        contact support.
      </Text>
    </Layout>
  );
}

export default SecurityAlertEmail;

const highBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#fef2f2",
  color: "#dc2626",
  borderRadius: "4px",
  padding: "4px 10px",
};

const mediumBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#fffbeb",
  color: "#d97706",
  borderRadius: "4px",
  padding: "4px 10px",
};
