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
  previewText: "You're invited to join Proptryx!",
  credEmail: "mondalsuman97322@gmail.com",
  credPassword: "password123",
  organizationName: "Acme Pvt Ltd",
  role: "Admin",
};

type MemberAccountCredEmailProps = {
  previewText: string;
  credEmail?: string;
  credPassword?: string;
  organizationName?: string;
  role?: string;
};

export const MemberAccountCredEmail = ({
  previewText,
  credEmail,
  credPassword,
  organizationName,
  role,
}: MemberAccountCredEmailProps) => {
  const getStartedLink = `${metadata.consoleUrl}/auth?cred_email=${encodeURIComponent(
    credEmail || ""
  )}&cred_password=${encodeURIComponent(credPassword || "")}&redirect=member-invitation`;

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
                  {/* Logo */}
                  <Section style={logo}>
                    <table align="center" style={{ margin: "0 auto" }}>
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: "middle" }}>
                            <Img
                              alt="Proptryx"
                              src={imgesdata.logoPath}
                              width={50}
                              style={logoImg}
                            />
                          </td>
                          <td width="10" />
                          <td style={{ verticalAlign: "middle" }}>
                            <Text style={brandText}>PropTryx</Text>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>

                  {/* Divider */}
                  <Section style={sectionsBorders}>
                    <Row>
                      <Column style={sectionBorder} />
                      <Column style={sectionCenter} />
                      <Column style={sectionBorder} />
                    </Row>
                  </Section>

                  {/* Heading */}
                  <Section style={content}>
                    <Text style={heading}>Welcome to {organizationName}! 🎉</Text>
                  </Section>

                  {/* Content */}
                  <Section style={content}>
                    <Text style={emphasizedText}>Hello,</Text>

                    <Text style={paragraph}>
                      You have been invited to join{" "}
                      <span style={{ fontWeight: "600", color: "#161950" }}>
                        {organizationName}
                      </span>{" "}
                      on Proptryx as a{" "}
                      <span style={{ fontWeight: "600", color: "#161950" }}>{role}</span>.
                    </Text>

                    <Text style={paragraph}>Here’s your Login Details:</Text>

                    {/* Credentials */}
                    <Section style={credentialsBox}>
                      <Text style={credentialLabel}>
                        Email ID: &nbsp;
                        <span style={credentialValue}>{credEmail}</span>
                      </Text>
                      <Text style={credentialLabel}>
                        Password: &nbsp;
                        <span style={credentialValue}>{credPassword}</span>
                      </Text>
                    </Section>

                    <Button href={getStartedLink} style={buttonStyle}>
                      Accept Invitation <span style={{ marginLeft: "8px" }}>→</span>
                    </Button>

                    <Text style={{ ...paragraph, marginTop: "24px" }}>
                      We’re excited to have you onboard. Start collaborating with your team.
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

                  {/* Divider */}
                  <Section style={sectionsBorders}>
                    <Row>
                      <Column style={sectionBorder} />
                      <Column style={sectionCenter} />
                      <Column style={sectionBorder} />
                    </Row>
                  </Section>

                  {/* Social */}
                  <Section style={socialSection}>
                    <table align="center" style={socialTable}>
                      <tbody>
                        <tr>
                          <td style={socialIconCell}>
                            <Link href={metadata.instagramUrl || "#"} style={socialLink}>
                              <Img src={imgesdata.instagramIcon} style={socialIcon} />
                            </Link>
                          </td>
                          <td width="15" />
                          <td style={socialIconCell}>
                            <Link href={metadata.facebookUrl || "#"} style={socialLink}>
                              <Img src={imgesdata.facebookIcon} style={socialIcon} />
                            </Link>
                          </td>
                          <td width="15" />
                          <td style={socialIconCell}>
                            <Link href={metadata.linkedinUrl || "#"} style={socialLink}>
                              <Img src={imgesdata.linkedinIcon} style={socialIcon} />
                            </Link>
                          </td>
                          <td width="15" />
                          <td style={socialIconCell}>
                            <Link href={metadata.twitterUrl || "#"} style={socialLink}>
                              <Img src={imgesdata.twitterIcon} style={socialIcon} />
                            </Link>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>

                  {/* Footer */}
                  {/* Footer */}
                  <Section style={footerSection}>
                    <Text style={footerText}>© 2026 Proptryx. All rights reserved.</Text>
                    <Text style={footerTextSmall}>
                      You are receiving this email because your account has sign-in activity. This
                      also indicates that you agree to our{" "}
                      <Link href={metadata.termsAndConditionsUrl} style={footerLink}>
                        Terms of Service
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

export default MemberAccountCredEmail;

export const renderMemberAccountCredEmail = async (props: MemberAccountCredEmailProps) =>
  await pretty(await render(<MemberAccountCredEmail {...props} />));

MemberAccountCredEmail.PreviewProps = defaultData;

// ================= STYLES =================

const main = {
  fontFamily: "'satoshi', 'Verdana', 'Arial', 'Helvetica', sans-serif",
  backgroundColor: "#F0F2FF",
  width: "100%",
  padding: "0",
  margin: "0",
};

const outerTable = {
  backgroundColor: "#F0F2FF",
  width: "100%",
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
  padding: "2px 20px",
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

const heading = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#161950",
  marginTop: "14px",
  textAlign: "center" as const,
};

const brandText = {
  margin: "0",
  fontSize: "24px",
  fontWeight: "700",
  color: "#161950",
};

const buttonStyle = {
  background: "linear-gradient(to bottom, #4962FF 0%, #4962FF 50%, #3E55EF 50%, #3E55EF 100%)",
  width: "100%",
  height: "40px",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 400,
  fontSize: "16px",
  border: "none",
  padding: "0",
  marginTop: "10px",
  textAlign: "center" as const,
  lineHeight: "40px",
};

const credentialsBox = {
  padding: "20px",
  backgroundColor: "#F8F9FF",
  border: "1.5px dashed #4962FF",
  margin: "16px 0 20px 0",
};

const credentialLabel = {
  fontSize: "14px",
  margin: "4px 0",
};

const credentialValue = {
  fontWeight: "600",
};

const link = {
  color: "#465FFF",
  textDecoration: "underline",
};

const sectionsBorders = {
  padding: "0 20px",
};

const sectionBorder = {
  borderBottom: "1px solid #D9D9D9",
};

const sectionCenter = {
  borderBottom: "1px solid #465FFF",
};

const regardsSection = {
  marginTop: "20px",
};

const socialSection = {
  padding: "10px",
  marginTop: "10px",
  textAlign: "center" as const,
};

const socialTable = {
  margin: "0 auto",
};

const socialIconCell = {
  padding: "0",
};

const socialIcon = {
  width: "32px",
  height: "32px",
};

const socialLink = {
  textDecoration: "none",
};

const footerSection = {
  padding: "15px",
  backgroundColor: "#FAFBFF",
  borderTop: "1px solid #E5E7EB",
};

const footerText = {
  textAlign: "center" as const,
  fontSize: "12px",
  marginBottom: "12px",
};

const footerTextSmall = {
  textAlign: "center" as const,
  fontSize: "11px",
};

const logo = {
  padding: "20px",
  textAlign: "center" as const,
};

const logoImg = {
  display: "block",
};

const footerLink = {
  fontSize: "11px",
  fontWeight: "500",
  textDecoration: "underline",
  color: "#465FFF",
};
