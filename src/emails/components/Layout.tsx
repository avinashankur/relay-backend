import {
  Body,
  Container,
  Head,
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

const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function Layout({ previewText, children }: LayoutProps) {
  return (
    <Tailwind>
      <Html lang="en">
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={bodyStyle}>
          <Container style={containerStyle}>
            {/* Wordmark */}
            <Section style={headerStyle}>
              <Text style={wordmarkStyle}>Relay</Text>
            </Section>

            {/* Card */}
            <Section style={cardStyle}>{children}</Section>

            {/* Footer */}
            <Section style={footerStyle}>
              <Text style={footerTextStyle}>
                © {new Date().getFullYear()} Relay &middot; Sent because an
                action was taken on your account.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily: sans,
  WebkitFontSmoothing: "antialiased",
  margin: "0",
  padding: "48px 0",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "0 32px",
};

const headerStyle: React.CSSProperties = {
  textAlign: "left",
  paddingBottom: "24px",
  borderBottom: "1px solid #f4f4f5",
  marginBottom: "32px",
};

const wordmarkStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "15px",
  fontWeight: "700",
  letterSpacing: "-0.02em",
  color: "#09090b",
  margin: "0",
};

const cardStyle: React.CSSProperties = {
  fontFamily: sans,
};

const footerStyle: React.CSSProperties = {
  textAlign: "left",
  paddingTop: "40px",
  borderTop: "1px solid #f4f4f5",
  marginTop: "32px",
};

const footerTextStyle: React.CSSProperties = {
  fontFamily: sans,
  fontSize: "12px",
  color: "#a1a1aa",
  lineHeight: "1.6",
  margin: "0",
};
