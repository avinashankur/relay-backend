import { Text, Section } from "@react-email/components";
import * as React from "react";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface PasswordResetEmailProps {
  resetUrl: string;
}

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <Layout previewText="Reset your IdentityCore password">
      <Text className="text-xl font-bold tracking-tight text-zinc-900 m-0 mb-3">
        Reset your password
      </Text>

      <Text className="text-sm text-zinc-600 leading-relaxed mt-0 mb-7">
        We received a request to reset your password. Click the button below to
        choose a new one. This link expires in <strong>30 minutes</strong> and
        can only be used once.
      </Text>

      <Section className="mb-7">
        <Button href={resetUrl}>Reset password</Button>
      </Section>

      <Text className="text-xs text-zinc-500 leading-relaxed mt-0 mb-4">
        If you didn't request a password reset, you can safely ignore this
        email. Your password will not be changed.
      </Text>

      <Text className="text-xs text-zinc-400 leading-relaxed m-0">
        Or copy and paste this URL into your browser:{" "}
        <span style={{ color: "#09090b", wordBreak: "break-all" }}>
          {resetUrl}
        </span>
      </Text>
    </Layout>
  );
}

export default PasswordResetEmail;
