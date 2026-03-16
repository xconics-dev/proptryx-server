import { env } from "@/config/env";
import Razorpay from "razorpay";

export const rzClient = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});
