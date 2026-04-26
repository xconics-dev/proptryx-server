import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { pretty, render } from "@react-email/render";
import { SatoshiFonts } from "../satoshi-fonts";
import { collageTailwindConfig } from "../theme";
import { metadata } from "../../static/const";
import EmailHeader from "../../components/email-header";
import { CredentialsBox } from "../../components/credentials-box";
import { EmailButton } from "../../components/email-button";
import Footer from "../../components/footer";
import { createCredentialAuthLink } from "./utils";

const defaultData = {
  previewText: "Your Proptryx Account is Ready!",
  credEmail: "mondalsuman97322@gmail.com",
  credPassword: "password123",
  organizationName: "Acme Pvt Ltd",
};

type AccountCredEmailProps = {
  previewText: string;
  credEmail?: string;
  credPassword?: string;
  organizationName?: string;
};

export const AccountCredEmail = ({
  previewText,
  credEmail = "",
  credPassword = "",
  organizationName,
}: AccountCredEmailProps) => {
  const getStartedLink = createCredentialAuthLink({ credEmail, credPassword });

  return (
    <Tailwind config={collageTailwindConfig}>
      <Html>
        <Head>
          <SatoshiFonts />
        </Head>
        <Body className="bg-canvas font-14 font-inter text-fg m-0 p-0">
          <Preview>{previewText}</Preview>
          <Container className="mx-auto max-w-[580px] px-4 pt-10 pb-6">
            <Section>
              <Section className="bg-bg border-stroke border">
                <EmailHeader />
                <Section className="mobile:px-6! px-8 pt-8 pb-10">
                  <Text className="font-32 text-fg m-0 font-sans">Proptryx Account Activated</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-4">Hello,</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Your organization{" "}
                    <span className="font-semibold text-fg">{organizationName}</span> has been
                    successfully activated to Proptryx.
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Here's your Login Details:
                  </Text>
                  <CredentialsBox email={credEmail} password={credPassword} />
                  <EmailButton href={getStartedLink}>Get started&nbsp;&nbsp;→</EmailButton>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[18px]">
                    We're excited to help you streamline your operations and grow.
                  </Text>
                  <Section className="mt-6">
                    <Text className="font-14 font-inter text-fg-2 m-0">
                      Best Regards,
                      <br />
                      <Link
                        href={metadata.mainpageUrl}
                        className="font-14 font-[700] text-brand underline"
                      >
                        Proptryx Team
                      </Link>
                    </Text>
                  </Section>
                </Section>
                <Footer />
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

AccountCredEmail.PreviewProps = defaultData;

export default AccountCredEmail;

export const renderAccountCredEmail = async ({
  previewText,
  credEmail,
  credPassword,
  organizationName,
}: AccountCredEmailProps) =>
  pretty(
    await render(
      <AccountCredEmail
        credEmail={credEmail}
        credPassword={credPassword}
        previewText={previewText}
        organizationName={organizationName}
      />
    )
  );
