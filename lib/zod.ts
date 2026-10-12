import { z } from "zod"
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
} from "@/lib/constants"

export const VOICE_NAMES = ["dave", "daniel", "chris", "rachel", "sarah"] as const

export const UploadSchema = z.object({
  title: z.string().trim().min(1, "Enter the book title.").max(100, "Title is too long!"),
  author: z.string().trim().min(1, "Enter the author's name.").max(100, "Author name is too long."),
  persona: z.enum(VOICE_NAMES, { error: "Choose an assistant voice." }),
  pdfFile: z.instanceof(File, { message: "PDF file is required" })
      .refine((file) => file.size <= MAX_FILE_SIZE, "File size must be less than 50MB")
      .refine((file) => ACCEPTED_PDF_TYPES.includes(file.type), "Only PDF files are accepted"),
  coverImage: z.instanceof(File).optional()
      .refine((file) => !file || file.size <= MAX_IMAGE_SIZE, "Image size must be less than 10MB")
      .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .jpeg, .png and .webp formats are supported"),
});
