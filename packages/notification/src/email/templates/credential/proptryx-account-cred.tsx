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

const defaultData = {
  previewText: "You're invited to join Proptryx!",
  credEmail: "mondalsuman97322@gmail.com",
  credPassword: "password123",
  role: "Admin",
};

type ProptryxAccountCredEmailProps = {
  previewText: string;
  credEmail?: string;
  credPassword?: string;
  role?: string;
};

export const ProptryxAccountCredEmail = ({
  previewText,
  credEmail = "",
  credPassword = "",
  role,
}: ProptryxAccountCredEmailProps) => {
  const getStartedLink = `${metadata.consoleUrl}/auth?cred_email=${encodeURIComponent(credEmail)}&cred_password=${encodeURIComponent(credPassword)}&redirect=member-invitation`;

  return (
    <Tailwind config={collageTailwindConfig}>
      <Html>
        <Head>
          <SatoshiFonts />
        </Head>
        <Body className="bg-canvas font-14 font-inter text-fg m-0 p-0">
          <Preview>{previewText}</Preview>
          <Container className="mx-auto max-w-[580px] px-4 pt-16 pb-6">
            <Section>
              <Section className="bg-bg border-stroke border">
                <EmailHeader />
                <Section className="mobile:px-6! px-8 pt-8 pb-10">
                  <Text className="font-32 text-fg m-0 font-sans">Welcome to Proptryx</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-4">Hello,</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Your Proptryx account has been successfully set up as a{" "}
                    <span className="font-semibold text-fg">{role}</span>.
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Here's your Login Details:
                  </Text>
                  <CredentialsBox email={credEmail} password={credPassword} />
                  <EmailButton href={getStartedLink}>Accept Invitation&nbsp;&nbsp;→</EmailButton>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[18px]">
                    We're excited to have you onboard. Start collaborating with your team.
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

ProptryxAccountCredEmail.PreviewProps = defaultData;

export default ProptryxAccountCredEmail;

export const renderProptryxAccountCredEmail = async (props: ProptryxAccountCredEmailProps) =>
  pretty(await render(<ProptryxAccountCredEmail {...props} />));
