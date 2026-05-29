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

export type PropertyPublishedToOwnerEmailProps = {
  previewText?: string;
  ownerName?: string;
  propertyName?: string;
  organizationName?: string;
  propertyUrl?: string;
  publishedAt?: NotificationDateTimeInput;
};

const defaultData = {
  previewText: "Your property is now live on Proptryx",
  ownerName: "Property Owner",
  propertyName: "Greenfield Business Park",
  organizationName: "Proptryx",
  propertyUrl: metadata.mainpageUrl,
  publishedAt: "2026-05-14T10:30:00+05:30",
} satisfies Required<PropertyPublishedToOwnerEmailProps>;

const PropertyPublishedToOwnerEmail = ({
  previewText = defaultData.previewText,
  ownerName = defaultData.ownerName,
  propertyName = defaultData.propertyName,
  organizationName = defaultData.organizationName,
  propertyUrl = defaultData.propertyUrl,
  publishedAt = defaultData.publishedAt,
}: PropertyPublishedToOwnerEmailProps) => {
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
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-4">Hello {ownerName},</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Your property <span className="font-semibold text-fg">{propertyName}</span> has
                    been published by{" "}
                    <span className="font-semibold text-fg">{organizationName}</span> and is now
                    visible on Proptryx.
                  </Text>
                  <Section className="bg-canvas border-stroke mt-5 border px-4 py-3">
                    <Text className="font-14 font-inter text-fg-2 m-0">
                      Property: <span className="font-semibold text-fg">{propertyName}</span>
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
                    If any details need correction, please contact your Proptryx representative.
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

PropertyPublishedToOwnerEmail.PreviewProps = defaultData;

export default PropertyPublishedToOwnerEmail;

export async function renderPropertyPublishedToOwnerEmail(
  props: Partial<PropertyPublishedToOwnerEmailProps> = {}
) {
  return pretty(
    await render(
      <PropertyPublishedToOwnerEmail
        organizationName={props.organizationName}
        ownerName={props.ownerName}
        previewText={props.previewText}
        propertyName={props.propertyName}
        propertyUrl={props.propertyUrl}
        publishedAt={props.publishedAt}
      />
    )
  );
}
