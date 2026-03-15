export type OrgFields = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "string[]" | "json";
  input: boolean;
  required?: boolean;
  defaultValue?: string | number | boolean | string[] | Record<string, unknown>;
};

export const orgFields: OrgFields[] = [
  {
    name: "email",
    type: "string",
    input: true,
  },
  {
    name: "phoneNumber",
    type: "string",
    input: true,
  },
  {
    name: "gstNumber",
    type: "string",
    input: true,
  },
  {
    name: "industry",
    type: "string",
    input: true,
  },
  {
    name: "type",
    type: "string",
    input: true,
  },
  {
    name: "companyType",
    type: "string",
    input: true,
  },
  {
    name: "isActive",
    type: "boolean",
    input: true,
  },
];
