import { Img, Link, Section, Text } from "@react-email/components";
import { imgesdata, metadata } from "../static/const";

export default function Footer() {
  return (
    <>
      {/* <Section className="mobile:px-6! px-10 py-5 bg-bg">
        <table
          align="center"
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
          style={{ margin: "0 auto", borderCollapse: "collapse" as const }}
        >
          <tbody>
            <tr>
              <td style={{ padding: 0, verticalAlign: "middle" as const }}>
                <Link
                  href={metadata.instagramUrl}
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  <Img
                    alt="Instagram"
                    src={imgesdata.instagramIcon}
                    width={32}
                    height={32}
                    style={{ display: "block", border: "0" }}
                  />
                </Link>
              </td>
              <td width="15" />
              <td style={{ padding: 0, verticalAlign: "middle" as const }}>
                <Link
                  href={metadata.facebookUrl}
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  <Img
                    alt="Facebook"
                    src={imgesdata.facebookIcon}
                    width={32}
                    height={32}
                    style={{ display: "block", border: "0" }}
                  />
                </Link>
              </td>
              <td width="15" />
              <td style={{ padding: 0, verticalAlign: "middle" as const }}>
                <Link
                  href={metadata.linkedinUrl}
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  <Img
                    alt="LinkedIn"
                    src={imgesdata.linkedinIcon}
                    width={32}
                    height={32}
                    style={{ display: "block", border: "0" }}
                  />
                </Link>
              </td>
              <td width="15" />
              <td style={{ padding: 0, verticalAlign: "middle" as const }}>
                <Link
                  href={metadata.twitterUrl}
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  <Img
                    alt="X (Twitter)"
                    src={imgesdata.twitterIcon}
                    width={32}
                    height={32}
                    style={{ display: "block", border: "0" }}
                  />
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </Section> */}

      <Section className="mobile:px-6! px-8 pt-4 pb-6 bg-bg border-t border-stroke">
        <Text className="font-11 font-inter text-fg m-0 mb-2 text-center font-[500]">
          © 2026 Proptryx. All rights reserved.
        </Text>
        <Text className="font-11 font-inter text-fg-3 m-0 text-center">
          You are receiving this email because it is related to your Proptryx account or activity.
          This also indicates that you agree to our{" "}
          <Link
            href={metadata.termsAndConditionsUrl}
            className="font-11 font-[500] text-brand underline"
          >
            Terms of Service
          </Link>{" "}
          and our policies, including{" "}
          <Link
            href={metadata.privacyPolicyOccupier}
            className="font-11 font-[500] text-brand underline"
          >
            Privacy Policy (Occupier)
          </Link>{" "}
          and{" "}
          <Link
            href={metadata.privacyPolicyDeveloper}
            className="font-11 font-[500] text-brand underline"
          >
            Privacy Policy (Developer)
          </Link>
          .
        </Text>
      </Section>
    </>
  );
}
