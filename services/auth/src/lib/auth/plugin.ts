import type { BetterAuthPlugin } from "better-auth";
import { type UserFields, userFields } from "./fields/user";

export const allowCustomInputFieldsPlugin = {
  id: "allow-custom-input-fields",
  schema: {
    user: {
      fields: Array.isArray(userFields)
        ? Object.fromEntries(
            userFields.map((field: UserFields) => [
              field.name,
              {
                type: field.type,
                input: field.input,
                required: field.required,
                fieldName: field.fieldName,
              },
            ])
          )
        : userFields,
    },
  },
} satisfies BetterAuthPlugin;
