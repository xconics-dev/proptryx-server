export type UserFields = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "string[]";
  input: boolean;
  required?: boolean;
  fieldName?: string;
};
export const userFields: UserFields[] = [
  {
    name: "role",
    type: "string",
    input: false,
  },
  {
    name: "panel",
    type: "string",
    input: false,
  },
  {
    name: "zoneId",
    type: "string",
    input: true,
  },
];
