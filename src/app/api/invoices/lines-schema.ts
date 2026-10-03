import { z } from "zod";

export const invoiceLineSchema = z.object({
  description: z.string().min(1),
  qty: z.coerce.number().default(1),
  unit: z.string().optional(),
  unitPrice: z.coerce.number().default(0),
  vatRate: z.coerce.number().default(21),
});

export const invoiceSourceSchema = z.object({
  type: z.enum(["quote", "calculation", "workorder"]),
  id: z.string().min(1),
  /** Offerte: alle regels i.p.v. één regel "volgens offerte". */
  detailed: z.boolean().optional(),
});
