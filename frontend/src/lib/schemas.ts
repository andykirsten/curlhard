import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Bitte E-Mail eingeben').email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Bitte Passwort eingeben'),
})

export const registerSchema = loginSchema.extend({
  display_name: z.string().min(1, 'Bitte Namen eingeben').max(80),
  password: z.string().min(10, 'Mindestens 10 Zeichen'),
  invite_code: z.string().min(1, 'Einladungscode erforderlich'),
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
