export const imgesdata = {
  bannerImagePath: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBk5Vr1tIzlrNhPYGefjnB9M1Tq4Wb3QE7xcaUJ",
  logoPath: "https://logistics-bucket.in-maa-1.linodeobjects.com/Proptryx/PropTryx_Logo%201.png",
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
