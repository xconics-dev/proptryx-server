import { Section, Text } from "react-email";

type Props = {
  email: string;
  password: string;
};

export function CredentialsBox({ email, password }: Props) {
  return (
    <Section className="my-5 p-4 border border-dashed border-brand bg-[#F8F9FF]">
      <Text className="font-14 font-inter text-fg m-0">
        Email: <span className="font-semibold ml-1">{email}</span>
      </Text>
      <Text className="font-14 font-inter text-fg m-0 mt-2">
        Password: <span className="font-semibold ml-1">{password}</span>
      </Text>
    </Section>
  );
}
