import { z } from "zod"
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
} from "@/lib/constants"

export const VOICE_NAMES = ["dave", "daniel", "chris", "rachel", "sarah"] as const

export const UploadSchema = z.object({
  pdfFile: z
    .file()
    .max(MAX_FILE_SIZE, "PDF files must be 50MB or smaller.")
    .mime(ACCEPTED_PDF_TYPES, "Choose a valid PDF file."),
  coverImage: z
    .file()
    .max(MAX_IMAGE_SIZE, "Cover images must be 10MB or smaller.")
    .mime(ACCEPTED_IMAGE_TYPES, "Choose a JPEG, PNG, or WebP image.")
    .optional(),
  title: z.string().trim().min(1, "Enter the book title."),
  author: z.string().trim().min(1, "Enter the author's name."),
  voice: z.enum(VOICE_NAMES, { error: "Choose an assistant voice." }),
})
