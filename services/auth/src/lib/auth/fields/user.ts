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
    input: true,
  },
  {
    name: "zoneId",
    type: "string",
    input: true,
  },
  {
    name: "phoneNumber",
    type: "string",
    input: true,
  },
];
