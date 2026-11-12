import { z } from 'zod';

export const planIds = ['full-access'] as const;
const contactFields = {
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  phone: z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true),
};
const hasContact = (value: {email?: string; phone?: string}) => Boolean(value.email || value.phone);
export const contactInput = z.object(contactFields).strict().refine(hasContact);
export const purchaseInput = z.object({ ...contactFields, plan: z.enum(planIds) }).strict().refine(hasContact);
