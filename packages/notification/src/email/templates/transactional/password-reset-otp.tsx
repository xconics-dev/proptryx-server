/** biome-ignore-all lint/suspicious/noArrayIndexKey: forced */

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
import { OtpDigits } from "../../components/otp-digits";
import Footer from "../../components/footer";

const defaultData = {
  otpCode: "572100",
  previewText: "Your Proptryx password reset verification code.",
  codeExpiryTime: "10",
};

type OtpEmailProps = {
  previewText: string;
  otpCode: string;
  codeExpiryTime?: string;
};

export const PasswordResetOtpEmail = ({
  otpCode = defaultData.otpCode,
  previewText = defaultData.previewText,
  codeExpiryTime = defaultData.codeExpiryTime,
}: OtpEmailProps) => (
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
                <Text className="font-32 text-fg m-0 font-sans">Reset Your Password</Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-4">Hello,</Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  We received a request to reset your Proptryx App password.
                </Text>
                <Text className="font-20 font-inter text-fg m-0 mt-5 font-[700]">
                  Enter this Password Reset OTP
                </Text>
                <OtpDigits otpCode={otpCode} />
                <Text className="font-14 font-inter text-fg-2 m-0 mt-2 font-semibold underline">
                  This code will expire in {codeExpiryTime} minutes.
                </Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  If you didn't send this request, you can ignore this email or review your recent
                  device activity.
                </Text>
                <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                  To help security, please don't share this OTP with anyone.
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

PasswordResetOtpEmail.PreviewProps = defaultData;

export default PasswordResetOtpEmail;

export const renderPasswordResetOtpEmail = async ({ otpCode, previewText }: OtpEmailProps) =>
  pretty(await render(<PasswordResetOtpEmail otpCode={otpCode} previewText={previewText} />));
