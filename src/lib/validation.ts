import { z } from "zod";
import { isIsoDate } from "./dates";

// zod schemas shared by server actions and route handlers. Every server entry point validates its input here.

export const isoDate = z.string().refine(isIsoDate, "Enter a valid date.");

export const stayQuery = z
  .object({
    arrive: isoDate,
    depart: isoDate,
    adults: z.coerce.number().int().min(1, "At least one adult is required.").max(20),
    children: z.coerce.number().int().min(0).max(20),
  })
  .refine((v) => v.depart > v.arrive, { message: "Departure must be after arrival.", path: ["depart"] });
export type StayQuery = z.infer<typeof stayQuery>;

/** Amenity selection as "id:qty,id:qty" in the URL; quantities 1..30. */
export const amenitySelection = z
  .string()
  .max(2000)
  .transform((s) =>
    s
      .split(",")
      .filter(Boolean)
      .map((pair) => {
        const [id, qty] = pair.split(":");
        return { id, quantity: Number(qty ?? "1") };
      }),
  )
  .pipe(z.array(z.object({ id: z.string().uuid(), quantity: z.number().int().min(1).max(30) })).max(20));

export const phone = z
  .string()
  .trim()
  .min(1, "Enter a mobile number we can reach on WhatsApp.")
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .refine((s) => /^\+?\d{10,15}$/.test(s), "Enter a mobile number we can reach on WhatsApp.");

export const guestDetails = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  phone,
  email: z.string().trim().email("Enter an email address we can write to.").max(200),
  arrivalTime: z.string().trim().max(40).default(""),
  requests: z.string().trim().max(1000).default(""),
  acceptRules: z.literal(true, {
    errorMap: () => ({ message: "Please confirm you have read the house rules." }),
  }),
});
export type GuestDetails = z.infer<typeof guestDetails>;

export const reference = z.string().regex(/^CRA-\d{4}-\d{4}$/);
export const accessToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const cancelReason = z.string().trim().min(2, "Give a short reason.").max(500);
