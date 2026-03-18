import type * as React from "react";

import {
  Body,
  Button,
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

import { imgesdata, metadata } from "../../static/const";

const defaultData = {
  previewText: "Your Hisaab Sathi Console Account is Ready!",
  credEmail: "mondalsuman97322@gmail.com",
  credPassword: "password123",
};

type ConsoleAccountCredEmailProps = {
  previewText: string;
  credEmail?: string;
  credPassword?: string;
};

export const ConsoleAccountCredEmail = ({
  previewText,
  credEmail,
  credPassword,
}: ConsoleAccountCredEmailProps) => {
  const getStartedLink = `${metadata.consoleUrl}/auth?cred_email=${encodeURIComponent(
    credEmail || ""
  )}&cred_password=${encodeURIComponent(credPassword || "")}`;

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
                  {/* Banner Section */}
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
                  <Text
                    style={{
                      fontSize: "22px",
                      fontWeight: "700",
                      color: "#161950",
                      marginTop: "14px",
                      textAlign: "center" as const,
                    }}
                  >
                    Welcome to Proptryx
                  </Text>
                  {/* Main Content */}
                  <Section style={content}>
                    <Text
                      style={{
                        ...emphasizedText,
                        marginTop: "12px",
                      }}
                    >
                      Hello,
                    </Text>
                    <Text style={paragraph}>
                      Welcome to Proptryx! We’ve successfully set up your console account, and
                      you’re all set to access your dashboard.
                    </Text>
                    <Text style={paragraph}>Here’s your Login Details:</Text>

                    {/* Credentials Box */}
                    <Section style={credentialsBox}>
                      <Text style={credentialLabel}>
                        Email ID: &nbsp;
                        <span style={credentialValue}>{`${credEmail}`}</span>
                      </Text>
                      <Text style={credentialLabel}>
                        Password: &nbsp;
                        <span style={credentialValue}>{credPassword}</span>
                      </Text>
                    </Section>

                    <Button
                      href={getStartedLink}
                      style={{
                        background:
                          "linear-gradient(to bottom, #4962FF 0%, #4962FF 50%, #3E55EF 50%, #3E55EF 100%)",
                        width: "100%",
                        height: "40px",
                        color: "#fff",
                        textDecoration: "none",
                        fontWeight: 400,
                        fontSize: "16px",
                        border: "none",
                        boxShadow: "none",
                        padding: "0",
                        cursor: "pointer",
                        letterSpacing: "0.02em",
                        marginTop: "10px",
                        textAlign: "center",
                        lineHeight: "40px",
                      }}
                    >
                      Get started <span style={{ marginLeft: "8px" }}>→</span>
                    </Button>

                    <Text
                      style={{
                        ...paragraph,
                        marginTop: "24px",
                      }}
                    >
                      We’re excited to help you streamline your operations and grow .
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

export default ConsoleAccountCredEmail;

export const renderConsoleAccountCredEmail = async ({
  previewText,
  credEmail,
  credPassword,
}: ConsoleAccountCredEmailProps) =>
  await pretty(
    await render(
      <ConsoleAccountCredEmail
        credEmail={credEmail}
        credPassword={credPassword}
        previewText={previewText}
      />
    )
  );

ConsoleAccountCredEmail.PreviewProps = defaultData;

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
  padding: "10px 20px",
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
  color: "#232323",
  margin: "14px 0",
};

const link = {
  fontSize: "14px",
  fontWeight: "700",
  textDecoration: "underline",
  color: "#465FFF",
};

const imageSection = {
  padding: "20px 30px",
  textAlign: "center" as const,
  backgroundColor: "#ffffff",
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
  marginTop: "30px",
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

const credentialsBox = {
  padding: "20px",
  backgroundColor: "#F8F9FF",
  border: "1.5px dashed #4962FF",
  margin: "16px 0 20px 0",
};

const credentialLabel = {
  fontSize: "14px",
  fontWeight: "400",
  color: "#161950",
  lineHeight: "1.8",
  margin: "4px 0",
};

const credentialValue = {
  fontWeight: "600",
  color: "#161950",
  textDecoration: "none",
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
