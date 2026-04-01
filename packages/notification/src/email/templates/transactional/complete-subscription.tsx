/** biome-ignore-all lint/suspicious/noExplicitAny: email template */

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
  Row,
  Section,
  Text,
} from "@react-email/components";
import { pretty, render } from "@react-email/render";
import { imgesdata, metadata } from "../../static/const";

/* ================= TYPES ================= */

export type CompleteSubscriptionEmailProps = {
  previewText?: string;
  organizationName?: string;
  planName?: string;
  paymentLink?: string;
};

/* ================= DEFAULT DATA ================= */

const defaultData: Required<CompleteSubscriptionEmailProps> = {
  previewText: "Complete your subscription purchase",
  organizationName: "Proptryx",
  planName: "Gold Plan",
  paymentLink: "https://proptryx.com/payment",
};

/* ================= COMPONENT ================= */

type CompleteSubscriptionEmailComponent = React.FC<CompleteSubscriptionEmailProps> & {
  PreviewProps?: CompleteSubscriptionEmailProps;
};

const CompleteSubscriptionEmail: CompleteSubscriptionEmailComponent = ({
  previewText = defaultData.previewText,
  organizationName = defaultData.organizationName,
  planName = defaultData.planName,
  paymentLink = defaultData.paymentLink,
}) => {
  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <Font fallbackFontFamily="Verdana" fontFamily="satoshi" fontStyle="normal" />
      </Head>

      <Body style={main}>
        <Preview>{previewText}</Preview>

        <table width="100%" style={outerTable} cellPadding="0" cellSpacing="0" role="presentation">
          <tbody>
            <tr>
              <td align="center" style={{ padding: "30px 15px" }}>
                <Container style={container}>
                  {/* LOGO */}
                  <Section style={logo}>
                    <table align="center" role="presentation">
                      <tbody>
                        <tr>
                          <td>
                            <Img
                              src={imgesdata.logoPath}
                              width={50}
                              alt="Proptryx"
                              style={{ display: "block" }}
                            />
                          </td>
                          <td width="10" />
                          <td>
                            <Text style={brandText}>Proptryx</Text>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>

                  {/* DIVIDER */}
                  <Section style={sectionsBorders}>
                    <Row>
                      <Column style={sectionBorder} />
                      <Column style={sectionCenter} />
                      <Column style={sectionBorder} />
                    </Row>
                  </Section>

                  {/* CONTENT */}
                  <Section style={content}>
                    <Text style={heading}>Complete Your Subscription Purchase</Text>

                    <Text style={paragraph}>Hello,</Text>

                    <Text style={paragraph}>
                      Your subscription for <strong>{planName}</strong> is ready for{" "}
                      <strong>{organizationName}</strong>.
                    </Text>

                    <Text style={paragraph}>
                      To activate your subscription, please complete the authorization using the
                      button below.
                    </Text>

                    {/* ✅ CONSOLE-STYLE BUTTON */}
                    <Button
                      href={paymentLink}
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
                      Complete Purchase
                      <span style={{ marginLeft: "8px" }}>→</span>
                    </Button>

                    <Text style={note}>This link may expire soon for security reasons.</Text>

                    <Text style={paragraph}>
                      If you didn’t request this, you can safely ignore this email.
                    </Text>

                    {/* SIGNATURE */}
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

CompleteSubscriptionEmail.PreviewProps = defaultData;

export default CompleteSubscriptionEmail;

/* ================= RENDER FUNCTION ================= */

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

/* ================= STYLES ================= */

const main: React.CSSProperties = {
  fontFamily: "'satoshi', 'Verdana', 'Arial', sans-serif",
  backgroundColor: "#F0F2FF",
  margin: "0",
  padding: "0",
};

const outerTable: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#F0F2FF",
};

const container: React.CSSProperties = {
  maxWidth: "580px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
};

const logo: React.CSSProperties = {
  padding: "20px",
  textAlign: "center",
};

const brandText: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#161950",
  margin: "0",
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

const content: React.CSSProperties = {
  padding: "20px",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#161950",
  textAlign: "center",
  marginBottom: "16px",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 14px 0",
};

const note: React.CSSProperties = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "10px",
};

const link: React.CSSProperties = {
  color: "#465FFF",
  textDecoration: "underline",
};

const regardsSection: React.CSSProperties = {
  marginTop: "20px",
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
