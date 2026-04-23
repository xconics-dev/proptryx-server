/** biome-ignore-all lint/suspicious/noExplicitAny: email template */

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
import { SatoshiFonts } from "./satoshi-fonts";
import { collageTailwindConfig } from "./theme";
import { metadata } from "../../static/const";
import EmailHeader from "../../components/email-header";
import { EmailButton } from "../../components/email-button";
import Footer from "../../components/footer";

export type CompleteSubscriptionEmailProps = {
  previewText?: string;
  organizationName?: string;
  planName?: string;
  paymentLink?: string;
};

const defaultData: Required<CompleteSubscriptionEmailProps> = {
  previewText: "Complete your subscription purchase",
  organizationName: "Proptryx",
  planName: "Gold Plan",
  paymentLink: "https://proptryx.com/payment",
};

const CompleteSubscriptionEmail = ({
  previewText = defaultData.previewText,
  organizationName = defaultData.organizationName,
  planName = defaultData.planName,
  paymentLink = defaultData.paymentLink,
}: CompleteSubscriptionEmailProps) => (
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
              <Section className="mobile:px-6! px-10 pt-8 pb-10">
                <Text className="font-32 text-fg m-0 font-sans">Complete Your Subscription</Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-4">Hello,</Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  Your subscription for <span className="font-semibold text-fg">{planName}</span> is
                  ready for <span className="font-semibold text-fg">{organizationName}</span>.
                </Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  To activate your subscription, please complete the authorization using the button
                  below.
                </Text>
                <EmailButton href={paymentLink} className="mt-5">
                  Complete Purchase&nbsp;&nbsp;→
                </EmailButton>
                <Text className="font-13 font-inter text-fg-3 m-0 mt-4">
                  This link may expire soon for security reasons.
                </Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  If you didn't request this, you can safely ignore this email.
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

CompleteSubscriptionEmail.PreviewProps = defaultData;

export default CompleteSubscriptionEmail;

export async function renderCompleteSubscriptionEmail(
  props: Partial<CompleteSubscriptionEmailProps> = {}
) {
  return pretty(
    await render(
      <CompleteSubscriptionEmail
        previewText={props.previewText}
        organizationName={props.organizationName}
        planName={props.planName}
        paymentLink={props.paymentLink}
      />
    )
  );
}
