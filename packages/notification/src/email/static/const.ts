export const imgesdata = {
  logoPath:
    "https://minio-console.proptryx.app/api/v1/download-shared-object/aHR0cHM6Ly9taW5pby1hcGkucHJvcHRyeXguYXBwL3Byb3B0cnl4LWZpbGUtZGIvc3RhdGljL1Byb3BUcnl4X0xvZ28lMjAxLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUo0NVdUNkNKWUhCTEgxTkY2SUJPJTJGMjAyNjA2MDYlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwNjA2VDE4MDgwMlomWC1BbXotRXhwaXJlcz00MzIwMCZYLUFtei1TZWN1cml0eS1Ub2tlbj1leUpoYkdjaU9pSklVelV4TWlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaFkyTmxjM05MWlhraU9pSktORFZYVkRaRFNsbElRa3hJTVU1R05rbENUeUlzSW1WNGNDSTZNVGM0TURneE1qUXlPU3dpY0dGeVpXNTBJam9pYldsdWFXOWhaRzFwYmlKOS5hSEUwTnUyZ1M4VF85Mnc2NEs1TjctczhHc1ByRkhFaVQ3NHlHUVJkV1ZHdS1YRkJRM3VDRnB3Q3lSNEJ6OFdXVHhCNV9RNFhTOS1fdUh1V0xVbjJzdyZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmdmVyc2lvbklkPW51bGwmWC1BbXotU2lnbmF0dXJlPWQyMWFjYzBiNjFkNTljZTMwYjI3YTM2NGY5YTkwZTE0MzgxNzU4YWVmZDYwMTAwNGYzOGUzYjg0M2YyYjE4YWQ",
  instagramIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkzKy0y33pqTPoMKVeJLNZvy76iQAB31SfgX2W",
  facebookIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkPMrd9hkTCVLKoj6mbtiv27lR31SAkuBNx8aU",
  linkedinIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkdmoUd0O1k0eSKmV8DXcrOfGNHaRQ62vy9tPp",
  twitterIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkKCNGEI811ktboWcYL0IhDM8a49TJ52j6iy3A",
};

export const metadata = {
  mainpageUrl: "https://www.proptryx.app",
  consoleUrl: "https://software.proptryx.app",
  privacyPolicyOccupier: "https://www.proptryx.app/privacy-policy-occupier",
  privacyPolicyDeveloper: "https://www.proptryx.app/privacy-policy-developer",
  termsAndConditionsUrl: "https://www.proptryx.app/terms-of-service",
  instagramUrl: "https://instagram.com",
  facebookUrl: "https://facebook.com",
  linkedinUrl: "https://linkedin.com",
  twitterUrl: "https://twitter.com",
};

type EmailSubPrev = {
  subject: string;
  previewText: string;
};

export const emailSubject: Record<string, EmailSubPrev> = {
  // transactional emails
  "sign-in": {
    subject: "Your Proptryx Sign-In Code",
    previewText: "Use this code to sign in to your Proptryx account. It expires in 10 minutes.",
  },
  "forget-password": {
    subject: "Reset Your Proptryx Password",
    previewText: "Your Proptryx password reset verification code.",
  },
  "complete-subscription": {
    subject: "Complete Your Proptryx Subscription Purchase",
    previewText: "Confirm purchase to activate your Proptryx Account",
  },
  "two-factor-code": {
    subject: "Your Proptryx Two-Factor Verification Code",
    previewText: "Your Proptryx two-factor verification code",
  },

  // credentials emails
  "account-credentials": {
    subject: "Your Proptryx Account Credentials",
    previewText: "Here are your Proptryx account login credentials.",
  },
  "member-account-cred": {
    subject: "Your Proptryx Account Credentials",
    previewText: "Here are your Proptryx account login credentials.",
  },
  "proptryx-account-cred": {
    subject: "Your Proptryx Account Credentials",
    previewText: "Here are your Proptryx account login credentials.",
  },
  "broker-cred": {
    subject: "You're now a Broker on Proptryx — Here are your credentials",
    previewText: "You're now a registered Broker on Proptryx!",
  },

  // notification emails

  "property-published-to-owner": {
    subject: "Your Property is Now Live on Proptryx!",
    previewText: "Congratulations! Your property has been published on Proptryx.",
  },
  "property-published-to-org-owner": {
    subject: "A New Property is Now Live on Proptryx!",
    previewText: "A new property has been published on Proptryx.",
  },
};
