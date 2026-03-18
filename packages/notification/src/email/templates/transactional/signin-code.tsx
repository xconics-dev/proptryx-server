/** biome-ignore-all lint/suspicious/noArrayIndexKey: OTP positions are fixed for a deterministic 6-digit code */
import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { pretty, render } from "@react-email/render";
import * as React from "react";
import { imgesdata, metadata } from "../../static/const";

const defaultData: SignInCodeEmailProps = {
  otpCode: "572100",
  previewText: "Your Proptryx sign-in verification code",
  codeExpiryTime: "10",
};

export type SignInCodeEmailProps = {
  previewText?: string;
  otpCode: string;
  codeExpiryTime?: string;
};

type SignInCodeEmailComponent = React.FC<SignInCodeEmailProps> & {
  PreviewProps?: SignInCodeEmailProps;
};

const SignInCodeEmail: SignInCodeEmailComponent = ({
  otpCode,
  previewText = defaultData.previewText,
  codeExpiryTime = defaultData.codeExpiryTime,
}) => {
  const digits = otpCode.padEnd(6, "0").slice(0, 6).split("");

  return (
    <Html>
      <Head>
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
        <meta content="text/html; charset=UTF-8" httpEquiv="Content-Type" />
        <Font
          fallbackFontFamily="Verdana"
          fontFamily="satoshi"
          fontStyle="normal"
          webFont={{
            url: "https://fonts.gstatic.com/s/worksans/v22/QGYsz_wNahGAdqQ43Rh_fKDp.woff2",
            format: "woff2",
          }}
        />
      </Head>

      <Body style={main}>
        <Preview>{previewText}</Preview>

        <table
          border={0}
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
          style={outerTable}
          width="100%"
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "30px 15px" }}>
                <Container style={container}>
                  <Section style={logo}>
                    <table
                      role="presentation"
                      border={0}
                      cellPadding="0"
                      cellSpacing="0"
                      align="center"
                      style={{ margin: "0 auto" }}
                    >
                      <tbody>
                        <tr>
                          {/* Logo */}
                          <td style={{ verticalAlign: "middle" }}>
                            <Img
                              alt="Proptryx"
                              src={imgesdata.logoPath}
                              width={50}
                              style={logoImg}
                            />
                          </td>

                          {/* Spacing */}
                          <td width="10" />

                          {/* Brand Name */}
                          <td style={{ verticalAlign: "middle" }}>
                            <Text
                              style={{
                                margin: "0",
                                fontFamily:
                                  "'satoshi', 'Verdana', 'Arial', 'Helvetica', sans-serif",
                                fontSize: "24px",
                                fontWeight: "700",
                                color: "#161950",
                                lineHeight: "1",
                              }}
                            >
                              PropTryx
                            </Text>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>

                  <Section style={sectionsBorders}>
                    <Row>
                      <Column style={sectionBorder} />
                      <Column style={sectionCenter} />
                      <Column style={sectionBorder} />
                    </Row>
                  </Section>

                  <Section style={content}>
                    <Text style={greeting}>Hello,</Text>
                    <Text style={extraEmphasizedText}>Enter this code to sign in</Text>

                    <table
                      border={0}
                      cellPadding="0"
                      cellSpacing="0"
                      role="presentation"
                      style={otpTable}
                      width="100%"
                    >
                      <tbody>
                        <tr>
                          {digits.map((digit, index) => (
                            <React.Fragment key={`otp-block-${index}`}>
                              <td style={otpCell} width="40">
                                <table
                                  border={0}
                                  cellPadding="0"
                                  cellSpacing="0"
                                  role="presentation"
                                  width="100%"
                                >
                                  <tbody>
                                    <tr>
                                      <td style={otpBlock}>
                                        <Text style={otpDigit}>{digit}</Text>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                              {index < digits.length - 1 ? <td width="6" /> : null}
                            </React.Fragment>
                          ))}
                        </tr>
                      </tbody>
                    </table>

                    <Text style={{ ...emphasizedText, marginTop: "16px" }}>
                      Enter the code above on your device to sign in to Proptryx. This code will
                      expire in {codeExpiryTime} minutes.
                    </Text>
                    <Text style={paragraph}>
                      If you did not request this action, you can ignore this email or review your
                      recent device activity.
                    </Text>
                    <Text style={paragraph}>
                      To help security, please do not share this code with anyone.
                    </Text>

                    <Section style={regardsSection}>
                      <Text style={paragraph}>
                        Best Regards,
                        <br />
                        <Link href={metadata.mainpageUrl} style={link}>
                          Proptryx Team
                        </Link>
                      </Text>
                    </Section>
                  </Section>

                  <Section style={sectionsBorders}>
                    <Row>
                      <Column style={sectionBorder} />
                      <Column style={sectionCenter} />
                      <Column style={sectionBorder} />
                    </Row>
                  </Section>

                  <Section style={socialSection}>
                    <table
                      align="center"
                      border={0}
                      cellPadding="0"
                      cellSpacing="0"
                      role="presentation"
                      style={socialTable}
                    >
                      <tbody>
                        <tr>
                          <td style={socialIconCell}>
                            <Link href={metadata.instagramUrl} style={socialLink}>
                              <Img
                                alt="Instagram"
                                height="32"
                                src={imgesdata.instagramIcon}
                                style={socialIcon}
                                width="32"
                              />
                            </Link>
                          </td>
                          <td width="15" />
                          <td style={socialIconCell}>
                            <Link href={metadata.facebookUrl} style={socialLink}>
                              <Img
                                alt="Facebook"
                                height="32"
                                src={imgesdata.facebookIcon}
                                style={socialIcon}
                                width="32"
                              />
                            </Link>
                          </td>
                          <td width="15" />
                          <td style={socialIconCell}>
                            <Link href={metadata.linkedinUrl} style={socialLink}>
                              <Img
                                alt="LinkedIn"
                                height="32"
                                src={imgesdata.linkedinIcon}
                                style={socialIcon}
                                width="32"
                              />
                            </Link>
                          </td>
                          <td width="15" />
                          <td style={socialIconCell}>
                            <Link href={metadata.twitterUrl} style={socialLink}>
                              <Img
                                alt="X (Twitter)"
                                height="32"
                                src={imgesdata.twitterIcon}
                                style={socialIcon}
                                width="32"
                              />
                            </Link>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>

                  <Section style={footerSection}>
                    <Text style={footerText}>© 2026 Proptryx. All rights reserved.</Text>
                    <Text style={footerTextSmall}>
                      You are receiving this email because your account has sign-in activity. This
                      also indicates that you agree to our{" "}
                      <Link href={metadata.termsAndConditionsUrl} style={footerLink}>
                        Terms of Use
                      </Link>{" "}
                      adn our policies, including{" "}
                      <Link href={metadata.privacyPolicyOccupier} style={footerLink}>
                        Privacy Policy (Occupier)
                      </Link>{" "}
                      and{" "}
                      <Link href={metadata.privacyPolicyDeveloper} style={footerLink}>
                        Privacy Policy (Developer)
                      </Link>
                      .
                    </Text>
                  </Section>
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
};

SignInCodeEmail.PreviewProps = defaultData;

export default SignInCodeEmail;

export async function renderSignInCodeEmail({
  otpCode,
  previewText = defaultData.previewText,
  codeExpiryTime = defaultData.codeExpiryTime,
}: SignInCodeEmailProps) {
  return pretty(
    await render(
      <SignInCodeEmail
        codeExpiryTime={codeExpiryTime}
        otpCode={otpCode}
        previewText={previewText}
      />
    )
  );
}

const main: React.CSSProperties = {
  fontFamily: "'satoshi', 'Verdana', 'Arial', 'Helvetica', sans-serif",
  backgroundColor: "#F0F2FF",
  width: "100%",
  padding: "0",
  margin: "0",
  WebkitTextSizeAdjust: "100%",
};

const outerTable: React.CSSProperties = {
  backgroundColor: "#F0F2FF",
  width: "100%",
  margin: "0",
  padding: "0",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: "580px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "2px",
  boxShadow: "0 2px 6px #d9d9d9",
};

const content: React.CSSProperties = {
  padding: "20px",
};

const greeting: React.CSSProperties = {
  lineHeight: "1.5",
  fontSize: "16px",
  fontWeight: "600",
  marginBottom: "12px",
  marginTop: "0",
  color: "#333333",
};

const paragraph: React.CSSProperties = {
  lineHeight: "1.6",
  fontSize: "14px",
  fontWeight: "400",
  color: "#333333",
  margin: "0 0 14px 0",
};

const emphasizedText: React.CSSProperties = {
  lineHeight: "1.6",
  fontSize: "14px",
  fontWeight: "600",
  color: "#232323",
  margin: "14px 0",
};

const link: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  textDecoration: "underline",
  color: "#465FFF",
};

const extraEmphasizedText: React.CSSProperties = {
  lineHeight: "1.5",
  fontSize: "18px",
  fontWeight: "700",
  color: "#232323",
  marginBottom: "18px",
  marginTop: "18px",
};

const logo: React.CSSProperties = {
  padding: "30px",
  textAlign: "center",
  backgroundColor: "#ffffff",
};

const logoImg: React.CSSProperties = {
  margin: "0 auto",
  display: "block",
  maxWidth: "100%",
};

const sectionsBorders: React.CSSProperties = {
  width: "100%",
  padding: "0 20px",
};

const sectionBorder: React.CSSProperties = {
  borderBottom: "1px solid #D9D9D9",
  width: "230px",
};

const sectionCenter: React.CSSProperties = {
  borderBottom: "1px solid #465FFF",
  width: "140px",
};

const regardsSection: React.CSSProperties = {
  marginTop: "24px",
};

const otpTable: React.CSSProperties = {
  margin: "20px 0",
  padding: "0",
  borderCollapse: "collapse",
  borderSpacing: "0",
  maxWidth: "280px",
};

const otpCell: React.CSSProperties = {
  padding: "0",
  verticalAlign: "middle",
  maxWidth: "40px",
};

const otpBlock: React.CSSProperties = {
  width: "100%",
  maxWidth: "40px",
  minWidth: "35px",
  backgroundColor: "#F0F2FF",
  borderRadius: "6px",
  textAlign: "center",
  verticalAlign: "middle",
  padding: "10px 0",
  border: "1px solid #E0E4FF",
  margin: "0",
};

const otpDigit: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#161950",
  display: "block",
  margin: "0",
  padding: "0",
  textAlign: "center",
  lineHeight: "1.2",
};

const socialSection: React.CSSProperties = {
  padding: "10px",
  marginTop: "10px",
  backgroundColor: "#ffffff",
  textAlign: "center",
};

const socialTable: React.CSSProperties = {
  margin: "0 auto",
  padding: "0",
  borderCollapse: "collapse",
  borderSpacing: "0",
};

const socialIconCell: React.CSSProperties = {
  padding: "0",
  verticalAlign: "middle",
};

const socialIcon: React.CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  display: "block",
  border: "0",
};

const socialLink: React.CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
};

const footerSection: React.CSSProperties = {
  width: "100%",
  padding: "20px 30px",
  backgroundColor: "#FAFBFF",
  borderTop: "1px solid #E5E7EB",
};

const footerText: React.CSSProperties = {
  textAlign: "center",
  fontSize: "12px",
  fontWeight: "500",
  lineHeight: "1.5",
  color: "#161950",
  margin: "0 0 12px 0",
};

const footerTextSmall: React.CSSProperties = {
  textAlign: "center",
  fontSize: "11px",
  fontWeight: "400",
  lineHeight: "1.6",
  color: "#6B7280",
  margin: "0",
};

const footerLink: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "500",
  textDecoration: "underline",
  color: "#465FFF",
};
