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
import { EmailButton } from "../../components/email-button";
import EmailHeader from "../../components/email-header";
import Footer from "../../components/footer";
import { metadata } from "../../static/const";
import { formatNotificationDateTime, type NotificationDateTimeInput } from "./utils";

export type PropertyPublishedToOrgOwnerEmailProps = {
  previewText?: string;
  orgOwnerName?: string;
  propertyOwnerName?: string;
  propertyName?: string;
  organizationName?: string;
  propertyUrl?: string;
  publishedAt?: NotificationDateTimeInput;
};

const defaultData = {
  previewText: "A property has been published for your organization",
  orgOwnerName: "Organization Owner",
  propertyOwnerName: "Property Owner",
  propertyName: "Greenfield Business Park",
  organizationName: "Proptryx",
  propertyUrl: metadata.mainpageUrl,
  publishedAt: "2026-05-14T10:30:00+05:30",
} satisfies Required<PropertyPublishedToOrgOwnerEmailProps>;

const PropertyPublishedToOrgOwnerEmail = ({
  previewText = defaultData.previewText,
  orgOwnerName = defaultData.orgOwnerName,
  propertyOwnerName = defaultData.propertyOwnerName,
  propertyName = defaultData.propertyName,
  organizationName = defaultData.organizationName,
  propertyUrl = defaultData.propertyUrl,
  publishedAt = defaultData.publishedAt,
}: PropertyPublishedToOrgOwnerEmailProps) => {
  const formattedPublishedAt = formatNotificationDateTime(publishedAt);

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
                  <Text className="font-32 text-fg m-0 font-sans">Property Published</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-4">
                    Hello {orgOwnerName},
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    A property under{" "}
                    <span className="font-semibold text-fg">{organizationName}</span> has been
                    published and is now visible on Proptryx.
                  </Text>
                  <Section className="bg-canvas border-stroke mt-5 border px-4 py-3">
                    <Text className="font-14 font-inter text-fg-2 m-0">
                      Property: <span className="font-semibold text-fg">{propertyName}</span>
                    </Text>
                    <Text className="font-14 font-inter text-fg-2 m-0 mt-[8px]">
                      Property owner:{" "}
                      <span className="font-semibold text-fg">{propertyOwnerName}</span>
                    </Text>
                    <Text className="font-14 font-inter text-fg-2 m-0 mt-[8px]">
                      Organization:{" "}
                      <span className="font-semibold text-fg">{organizationName}</span>
                    </Text>
                    <Text className="font-14 font-inter text-fg-2 m-0 mt-[8px]">
                      Published on:{" "}
                      <span className="font-semibold text-fg">{formattedPublishedAt}</span>
                    </Text>
                  </Section>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    You can review the public property page using the button below.
                  </Text>
                  <EmailButton href={propertyUrl} className="mt-5">
                    View Property&nbsp;&nbsp;&rarr;
                  </EmailButton>
                  <Text className="font-13 font-inter text-fg-3 m-0 mt-4">
                    This notification is for organization visibility and audit context.
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

PropertyPublishedToOrgOwnerEmail.PreviewProps = defaultData;

export default PropertyPublishedToOrgOwnerEmail;

export async function renderPropertyPublishedToOrgOwnerEmail(
  props: Partial<PropertyPublishedToOrgOwnerEmailProps> = {}
) {
  return pretty(
    await render(
      <PropertyPublishedToOrgOwnerEmail
        organizationName={props.organizationName}
        orgOwnerName={props.orgOwnerName}
        previewText={props.previewText}
        propertyName={props.propertyName}
        propertyOwnerName={props.propertyOwnerName}
        propertyUrl={props.propertyUrl}
        publishedAt={props.publishedAt}
      />
    )
  );
}
