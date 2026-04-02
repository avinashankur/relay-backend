import { Text, Section } from "@react-email/components";
import { Layout } from "./components/Layout";

interface OtpEmailProps {
  code: string;
}

export function OtpEmail({ code }: OtpEmailProps) {
  const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;

  return (
    <Layout
      previewText={`${formattedCode} is your IdentityCore verification code`}
    >
      <Text className="text-xl font-bold tracking-tight text-zinc-900 m-0 mb-3">
        Your verification code
      </Text>

      <Text className="text-sm text-zinc-600 leading-relaxed mt-0 mb-7">
        Use the code below to complete your sign-in. It expires in{" "}
        <strong>10 minutes</strong>.
      </Text>

      <Section className="bg-zinc-100 rounded-lg py-5 text-center mb-7">
        <Text
          className="text-4xl font-bold text-zinc-900 m-0"
          style={{
            letterSpacing: "6px",
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          {formattedCode}
        </Text>
      </Section>

      <Text className="text-xs text-zinc-500 leading-relaxed m-0">
        You have <strong>5 attempts</strong> before the code is locked. If you
        didn't request this code, please ignore this email.
      </Text>
    </Layout>
  );
}

export default OtpEmail;
