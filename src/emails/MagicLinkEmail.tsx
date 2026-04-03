import { Text, Section } from "@react-email/components";
import { Layout } from "./components/Layout";
import { Button } from "./components/Button";

interface MagicLinkEmailProps {
  magicLinkUrl: string;
}

export function MagicLinkEmail({ magicLinkUrl }: MagicLinkEmailProps) {
  return (
    <Layout previewText="Your sign-in link — expires in 15 minutes">
      <Text className="text-xl font-bold tracking-tight text-zinc-900 m-0 mb-3">
        Your sign-in link
      </Text>

      <Text className="text-sm text-zinc-600 leading-relaxed mt-0 mb-7">
        Click the button below to sign in. This link is single-use and expires
        in <strong>15 minutes</strong>.
      </Text>

      <Section className="mb-7">
        <Button href={magicLinkUrl}>Sign in to Relay</Button>
      </Section>

      <Text className="text-xs text-zinc-500 leading-relaxed mt-0 mb-4">
        If you didn't request this link, you can safely ignore this email. Your
        account is secure.
      </Text>

      <Text className="text-xs text-zinc-400 leading-relaxed m-0">
        Or copy and paste this URL into your browser:{" "}
        <span style={{ color: "#09090b", wordBreak: "break-all" }}>
          {magicLinkUrl}
        </span>
      </Text>
    </Layout>
  );
}

export default MagicLinkEmail;
