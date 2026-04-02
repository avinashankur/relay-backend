import { Text, Section } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface SignupVerificationEmailProps {
  verificationUrl: string;
}

export function SignupVerificationEmail({
  verificationUrl,
}: SignupVerificationEmailProps) {
  return (
    <Layout previewText="Verify your email address to get started">
      <Text className="text-xl font-bold tracking-tight text-zinc-900 m-0 mb-3">
        Verify your email
      </Text>

      <Text className="text-sm text-zinc-600 leading-relaxed mt-0 mb-7">
        Thanks for signing up. Click the button below to verify your email
        address and activate your account.
      </Text>

      <Section className="mb-7">
        <Button href={verificationUrl}>Verify email address</Button>
      </Section>

      <Text className="text-xs text-zinc-500 leading-relaxed mt-0 mb-4">
        This link expires in <strong>24 hours</strong>. If you didn't create an
        account, you can safely ignore this email.
      </Text>

      <Text className="text-xs text-zinc-400 leading-relaxed m-0">
        Or copy and paste this URL into your browser:{" "}
        <span style={{ color: "#09090b", wordBreak: "break-all" }}>
          {verificationUrl}
        </span>
      </Text>
    </Layout>
  );
}

export default SignupVerificationEmail;
