export type OrgFields = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "string[]" | "json";
  input: boolean;
  required?: boolean;
  defaultValue?: number;
};
export const orgFields: OrgFields[] = [
  {
    name: "email",
    type: "string",
    input: true,
  },
];
