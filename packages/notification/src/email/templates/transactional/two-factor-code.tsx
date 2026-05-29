/** biome-ignore-all lint/suspicious/noArrayIndexKey: OTP positions are fixed for a deterministic 6-digit code */

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
import { OtpDigits } from "../../components/otp-digits";
import Footer from "../../components/footer";

const defaultData = {
  otpCode: "572100",
  previewText: "Your Proptryx two-factor verification code",
  codeExpiryTime: "10",
};

export type TwoFactorCodeEmailProps = {
  previewText?: string;
  otpCode: string;
  codeExpiryTime?: string;
};

const TwoFactorCodeEmail = ({
  otpCode = defaultData.otpCode,
  previewText = defaultData.previewText,
  codeExpiryTime = defaultData.codeExpiryTime,
}: TwoFactorCodeEmailProps) => (
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
                <Text className="font-32 text-fg m-0 font-sans">Verify Your Identity</Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-4">Hello User,</Text>
                <Text className="font-20 font-inter text-fg m-0 mt-5 font-[700]">
                  Enter this code to continue
                </Text>
                <OtpDigits otpCode={otpCode} />
                <Text className="font-14 font-inter text-fg-2 m-0 mt-2">
                  Enter the code above to complete your two-factor verification. This code will
                  expire in <span className="font-semibold">{codeExpiryTime}</span> minutes.
                </Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  If you did not request this action, you can ignore this email or review your
                  recent device activity.
                </Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  To help security, please do not share this code with anyone.
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

TwoFactorCodeEmail.PreviewProps = defaultData;

export default TwoFactorCodeEmail;

export async function renderTwoFactorCodeEmail({
  otpCode,
  previewText = defaultData.previewText,
  codeExpiryTime = defaultData.codeExpiryTime,
}: TwoFactorCodeEmailProps) {
  return pretty(
    await render(
      <TwoFactorCodeEmail
        codeExpiryTime={codeExpiryTime}
        otpCode={otpCode}
        previewText={previewText}
      />
    )
  );
}
