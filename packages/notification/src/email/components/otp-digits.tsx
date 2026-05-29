import { Text } from "react-email";
import * as React from "react";

type Props = {
  otpCode: string;
};

const OTP_SLOT_IDS = ["slot-1", "slot-2", "slot-3", "slot-4", "slot-5", "slot-6"] as const;

export function OtpDigits({ otpCode }: Props) {
  const digits = otpCode
    .padEnd(6, "0")
    .slice(0, 6)
    .split("")
    .map((digit, index) => ({
      digit,
      slotId: OTP_SLOT_IDS[index],
    }));

  return (
    <table
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{
        borderCollapse: "collapse",
        borderSpacing: 0,
        maxWidth: "280px",
        margin: "20px 0",
      }}
    >
      <tbody>
        <tr>
          {digits.map(({ digit, slotId }, i) => (
            <React.Fragment key={slotId}>
              <td width={40} style={{ padding: 0, verticalAlign: "middle", maxWidth: "40px" }}>
                <table cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                  <tbody>
                    <tr>
                      <td
                        style={{
                          width: "100%",
                          maxWidth: "40px",
                          minWidth: "35px",
                          backgroundColor: "#F0F2FF",
                          borderRadius: "6px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          padding: "10px 0",
                          border: "1px solid #E0E4FF",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "#161950",
                            display: "block",
                            margin: 0,
                            padding: 0,
                            textAlign: "center",
                            lineHeight: "1.2",
                          }}
                        >
                          {digit}
                        </Text>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              {i < 5 && <td width={6} />}
            </React.Fragment>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
