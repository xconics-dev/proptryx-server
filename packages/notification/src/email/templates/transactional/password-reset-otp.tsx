/** biome-ignore-all lint/suspicious/noArrayIndexKey: forced */

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
  pretty,
  Row,
  render,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import { imgesdata, metadata } from "../../static/const";

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

export const PasswordResetOtpEmail = ({ otpCode, previewText, codeExpiryTime }: OtpEmailProps) => {
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
            url: "./static/fonts/satoshi-regular.otf",
            format: "opentype",
          }}
        />
      </Head>

      <Body style={main}>
        <Preview>{previewText}</Preview>

        {/* Outer wrapper table for full email client compatibility */}
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
                  {/* Logo Section */}
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

                  {/* Decorative Border */}
                  <Section style={sectionsBorders}>
                    <Row>
                      <Column style={sectionBorder} />
                      <Column style={sectionCenter} />
                      <Column style={sectionBorder} />
                    </Row>
                  </Section>

                  {/* Main Content */}
                  <Section style={content}>
                    <Text style={greeting}>Hello,</Text>
                    <Text style={paragraph}>
                      We received a request to reset your Proptryx App password.
                    </Text>
                    <Text style={extraEmphasizedText}>Enter this Password Reset OTP</Text>

                    {/* OTP Blocks - Mobile Responsive with Fixed Max Width */}
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
                            <React.Fragment key={`digit-block-${index}`}>
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
                              {/* Add spacer between blocks except after last one */}
                              {index < digits.length - 1 && (
                                <td key={`spacer-block-${index}`} width="6" />
                              )}
                            </React.Fragment>
                          ))}
                        </tr>
                      </tbody>
                    </table>

                    <Text
                      style={{
                        ...emphasizedText,
                        marginTop: "16px",
                      }}
                    >
                      This code will expire in {codeExpiryTime || "10"} minutes.
                    </Text>
                    <Text style={paragraph}>
                      If you didn't send this request, you can ignore this email or review your
                      recent device activity.
                    </Text>
                    <Text style={paragraph}>
                      To help security, please don't share this OTP with anyone.
                    </Text>

                    {/* Regards Section */}
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

                  {/* Social Media Icons Section - WITH SPACER CELLS */}
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
                            <Link href={metadata.instagramUrl || "#"} style={socialLink}>
                              <Img
                                alt="Instagram"
                                height="32"
                                src={imgesdata.instagramIcon}
                                style={socialIcon}
                                width="32"
                              />
                            </Link>
                          </td>
                          <td width="15" /> {/* Spacer cell */}
                          <td style={socialIconCell}>
                            <Link href={metadata.facebookUrl || "#"} style={socialLink}>
                              <Img
                                alt="Facebook"
                                height="32"
                                src={imgesdata.facebookIcon}
                                style={socialIcon}
                                width="32"
                              />
                            </Link>
                          </td>
                          <td width="15" /> {/* Spacer cell */}
                          <td style={socialIconCell}>
                            <Link href={metadata.linkedinUrl || "#"} style={socialLink}>
                              <Img
                                alt="LinkedIn"
                                height="32"
                                src={imgesdata.linkedinIcon}
                                style={socialIcon}
                                width="32"
                              />
                            </Link>
                          </td>
                          <td width="15" /> {/* Spacer cell */}
                          <td style={socialIconCell}>
                            <Link href={metadata.twitterUrl || "#"} style={socialLink}>
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

                  {/* Footer */}
                  <Section style={footerSection}>
                    <Text style={footerText}>© 2026 Proptryx. All rights reserved.</Text>
                    <Text style={footerTextSmall}>
                      You are receiving this mail because you registered on Proptryx. This also
                      shows that you agree to our{" "}
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

export default PasswordResetOtpEmail;

export const renderPasswordResetOtpEmail = async ({ otpCode, previewText }: OtpEmailProps) =>
  await pretty(await render(<PasswordResetOtpEmail otpCode={otpCode} previewText={previewText} />));

PasswordResetOtpEmail.PreviewProps = defaultData;

// ========== STYLES ==========

const main = {
  fontFamily: "'satoshi', 'Verdana', 'Arial', 'Helvetica', sans-serif",
  backgroundColor: "#F0F2FF",
  width: "100%",
  padding: "0",
  margin: "0",
  WebkitTextSizeAdjust: "100%",
  msTextSizeAdjust: "100%",
};

const outerTable = {
  backgroundColor: "#F0F2FF",
  width: "100%",
  margin: "0",
  padding: "0",
};

const container = {
  width: "100%",
  maxWidth: "580px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "2px",
  boxShadow: "0 2px 6px #d9d9d9",
};

const content = {
  padding: "20px",
};

const greeting = {
  lineHeight: "1.5",
  fontSize: "16px",
  fontWeight: "600",
  marginBottom: "12px",
  marginTop: "0",
  color: "#333333",
};

const paragraph = {
  lineHeight: "1.6",
  fontSize: "14px",
  fontWeight: "400",
  color: "#333333",
  margin: "0 0 14px 0",
};

const emphasizedText = {
  lineHeight: "1.6",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "underline",
  color: "#232323",
  margin: "14px 0",
};

const link = {
  fontSize: "14px",
  fontWeight: "700",
  textDecoration: "underline",
  color: "#465FFF",
};

const extraEmphasizedText = {
  lineHeight: "1.5",
  fontSize: "18px",
  fontWeight: "700",
  color: "#232323",
  marginBottom: "18px",
  marginTop: "18px",
};

const logo = {
  padding: "30px",
  textAlign: "center" as const,
  backgroundColor: "#ffffff",
};

const logoImg = {
  margin: "0 auto",
  display: "block",
  maxWidth: "100%",
};

const sectionsBorders = {
  width: "100%",
  padding: "0 20px",
};

const sectionBorder = {
  borderBottom: "1px solid #D9D9D9",
  width: "230px",
};

const sectionCenter = {
  borderBottom: "1px solid #465FFF",
  width: "140px",
};

const regardsSection = {
  marginTop: "24px",
};

// OTP Blocks Styles - MOBILE RESPONSIVE
const otpTable = {
  margin: "20px 0",
  padding: "0",
  borderCollapse: "collapse" as const,
  borderSpacing: "0",
  maxWidth: "280px", // Limits total width: 6 blocks * 40px + 5 spacers * 6px = 270px
};

const otpCell = {
  padding: "0",
  verticalAlign: "middle" as const,
  maxWidth: "40px",
};

const otpBlock = {
  width: "100%",
  maxWidth: "40px",
  minWidth: "35px", // Ensures minimum size on very small screens
  backgroundColor: "#F0F2FF",
  borderRadius: "6px",
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
  padding: "10px 0",
  border: "1px solid #E0E4FF",
  margin: "0",
};

const otpDigit = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#161950",
  display: "block",
  margin: "0",
  padding: "0",
  textAlign: "center" as const,
  lineHeight: "1.2",
};

// Social Media Icons Styles
const socialSection = {
  padding: "10px",
  marginTop: "10px",
  backgroundColor: "#ffffff",
  textAlign: "center" as const,
};

const socialTable = {
  margin: "0 auto",
  padding: "0",
  borderCollapse: "collapse" as const,
  borderSpacing: "0",
};

const socialIconCell = {
  padding: "0",
  verticalAlign: "middle" as const,
};

const socialIcon = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  display: "block",
  border: "0",
};

const socialLink = {
  display: "inline-block",
  textDecoration: "none",
};

// Footer Styles
const footerSection = {
  width: "100%",
  padding: "20px 30px",
  backgroundColor: "#FAFBFF",
  borderTop: "1px solid #E5E7EB",
};

const footerText = {
  textAlign: "center" as const,
  fontSize: "12px",
  fontWeight: "500",
  lineHeight: "1.5",
  color: "#161950",
  margin: "0 0 12px 0",
};

const footerTextSmall = {
  textAlign: "center" as const,
  fontSize: "11px",
  fontWeight: "400",
  lineHeight: "1.6",
  color: "#6B7280",
  margin: "0",
};

const footerLink = {
  fontSize: "11px",
  fontWeight: "500",
  textDecoration: "underline",
  color: "#465FFF",
};
