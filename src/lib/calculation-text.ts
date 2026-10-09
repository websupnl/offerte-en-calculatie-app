import { z } from "zod";

/** Tekstcorrecties mogen nooit calculatieregels of prijsvelden meesturen. */
export const calculationTextSchema = z.object({
  title: z.string().trim().min(1, "Titel is verplicht").optional(),
  description: z.string().nullable().optional(),
}).strict().refine((data) => data.title !== undefined || data.description !== undefined, {
  message: "Geef een titel of beschrijving op",
});
