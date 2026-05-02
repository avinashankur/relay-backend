import { Text, Section } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface DemoEmailProps {
  recipientEmail: string;
}

export function DemoEmail({ recipientEmail }: DemoEmailProps) {
  return (
    <Layout previewText="[TEST] Demo email from Relay">
      <Text className="text-xl font-bold tracking-tight text-zinc-900 m-0 mb-3">
        This is a test email
      </Text>

      <Text className="text-sm text-zinc-600 leading-relaxed mt-0 mb-7">
        This email was sent to <strong>{recipientEmail}</strong> as part of a
        testing flow. No action is required — this is not a real transactional
        email.
      </Text>

      <Section className="mb-7">
        <Button href="#">Test button (no-op)</Button>
      </Section>

      <Text className="text-xs text-zinc-500 leading-relaxed mt-0 mb-4">
        If you received this by mistake, please ignore it. This email is only
        used to verify the email delivery pipeline.
      </Text>
    </Layout>
  );
}

export default DemoEmail;
