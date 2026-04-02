import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface LayoutProps {
  previewText: string;
  children: React.ReactNode;
}

export function Layout({ previewText, children }: LayoutProps) {
  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body className="bg-zinc-100 py-10 m-0" style={bodyFont}>
          <Container className="max-w-[500px] mx-auto">
            {/* Logo Section */}
            <Section className="text-center mb-6">
              <Text
                className="text-xl font-bold tracking-tight text-zinc-900 m-0"
                style={wordmarkFont}
              >
                Identity Core
              </Text>
            </Section>
            {/* Content Section */}
            <Section className="bg-white rounded-lg px-12 py-10 border border-neutral-200">
              {children}
            </Section>
            {/* Footer */}
            <Hr className="border-neutral-200 my-6" />
            <Section className="text-center">
              <Text className="text-xs text-zinc-400 leading-relaxed m-0">
                You're receiving this email because an action was taken on your
                IdentityCore account.
              </Text>
              <Text className="text-xs text-zinc-400 leading-relaxed mt-1 mb-0">
                © {new Date().getFullYear()} IdentityCore. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

const bodyFont: React.CSSProperties = {
  fontFamily: "'Georgia', 'Times New Roman', serif",
};

const wordmarkFont: React.CSSProperties = {
  fontFamily: "'Georgia', serif",
};
