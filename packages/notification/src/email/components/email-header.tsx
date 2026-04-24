import { Img, Section } from "@react-email/components";
import { imgesdata } from "../static/const";

export default function EmailHeader() {
  return (
    <Section className="mobile:px-6! px-8 pt-16">
      <Img src={imgesdata.logoPath} alt="" width={60} height={60} className="block border-none" />
    </Section>
  );
}
