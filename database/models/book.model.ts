import { Document, models, Schema, model } from "mongoose";
import { IBook } from "@/types";
import { unique } from "next/dist/build/utils";
import { lowercase, trim } from "zod";
  
  const BookSchema = new Schema<IBook>({
    clerkId: { type: String, required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique:true, lowercase: true, trim: true },
    author: { type: String, required: true },
    persona: { type: String, required: true },
    fileURL: { type: String, required: true },
    fileBlobKey: { type: String },
    coverURL: { type: String },
    coverBlobKey: { type: String },
    fileSize: { type: Number, required: true },
    totalSegments: { type: Number, default: 0 },
  }, { timestamps: true })
  
  const Book = models.Book || model<IBook>('Book', BookSchema);
