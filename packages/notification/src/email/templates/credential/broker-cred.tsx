import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  pretty,
  render,
  Text,
} from "react-email";
import { SatoshiFonts } from "../satoshi-fonts";
import { collageTailwindConfig } from "../theme";
import { metadata } from "../../static/const";
import EmailHeader from "../../components/email-header";
import { CredentialsBox } from "../../components/credentials-box";
import { EmailButton } from "../../components/email-button";
import Footer from "../../components/footer";
import { createCredentialAuthLink } from "./utils";

const defaultData = {
  previewText: "You're now a registered Broker on Proptryx!",
  credEmail: "broker@example.com",
  credPassword: "password123",
  brokerName: "Suman Mondal",
  regionName: "INDIA",
  zoneName: "EAST",
};

type BrokerCredEmailProps = {
  previewText: string;
  credEmail?: string;
  credPassword?: string;
  brokerName?: string;
  regionName?: string;
  zoneName?: string;
};

export const BrokerCredEmail = ({
  previewText,
  credEmail = "",
  credPassword = "",
  brokerName,
  regionName,
  zoneName,
}: BrokerCredEmailProps) => {
  const getStartedLink = createCredentialAuthLink({ credEmail, credPassword });

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
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-4">
                    Hello{brokerName ? `, ${brokerName}` : ""},
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    You have been successfully registered as a{" "}
                    <span className="font-semibold text-fg">Broker</span> on Proptryx.
                    {regionName || zoneName ? (
                      <>
                        {" "}
                        You are assigned to{" "}
                        {zoneName ? (
                          <>
                            <span className="font-semibold text-fg">{zoneName}</span>
                            {regionName ? (
                              <>
                                {" "}
                                zone under the{" "}
                                <span className="font-semibold text-fg">{regionName}</span> region
                              </>
                            ) : null}
                          </>
                        ) : (
                          <>
                            the <span className="font-semibold text-fg">{regionName}</span> region
                          </>
                        )}
                        .
                      </>
                    ) : null}
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Here are your login credentials to get started:
                  </Text>
                  <CredentialsBox email={credEmail} password={credPassword} />
                  <EmailButton href={getStartedLink}>Get Started&nbsp;&nbsp;→</EmailButton>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[18px]">
                    Please change your password after your first login. If you have any questions,
                    feel free to reach out to our support team.
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

BrokerCredEmail.PreviewProps = defaultData;

export default BrokerCredEmail;

export const renderBrokerCredEmail = async (props: BrokerCredEmailProps) =>
  pretty(await render(<BrokerCredEmail {...props} />));
