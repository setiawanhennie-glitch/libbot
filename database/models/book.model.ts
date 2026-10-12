import { models, Schema, model } from "mongoose";
import { IBook } from "@/types";
import { DEFAULT_VOICE } from "@/lib/constants";
  
  const BookSchema = new Schema<IBook>({
    clerkId: { type: String, required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    author: { type: String, required: true },
    persona: { type: String, default: DEFAULT_VOICE },
    fileURL: { type: String, required: true },
    fileBlobKey: { type: String },
    coverURL: { type: String },
    coverBlobKey: { type: String },
    fileSize: { type: Number, required: true },
    totalSegments: { type: Number, default: 0 },
  }, { timestamps: true })

  BookSchema.index({ clerkId: 1, slug: 1 }, { unique: true });
  
  const Book = models.Book || model<IBook>('Book', BookSchema);

  export default Book;