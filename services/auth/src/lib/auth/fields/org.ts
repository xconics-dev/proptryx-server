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
];
