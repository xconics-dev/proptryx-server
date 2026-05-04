import { metadata } from "../../static/const";

type CredentialAuthLinkOptions = {
  credEmail?: string;
  credPassword?: string;
};

export const createCredentialAuthLink = ({
  credEmail = "",
  credPassword = "",
}: CredentialAuthLinkOptions) => {
  const authUrl = new URL("/auth", metadata.consoleUrl);
  authUrl.search = [
    `cred_email=${encodeURIComponent(credEmail)}`,
    `cred_password=${encodeURIComponent(credPassword)}`,
    "button_action=auto",
  ].join("&");

  return authUrl.toString();
};
