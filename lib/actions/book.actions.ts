'use server';

import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import { generateSlug } from "@/lib/utils";
import { DEFAULT_VOICE } from "@/lib/constants";
import Book from "@/database/models/book.model";
import { serializeData } from "@/lib/utils";
import BookSegment from "@/database/models/book-segment.model";
import { auth } from "@clerk/nextjs/server";

export const checkBookExists = async (title: string) => {
    try {
        await connectToDatabase();

        const slug = generateSlug(title);

        const existingBook = await Book.findOne({slug}).lean();

        if(existingBook) {
            return {
                exists: true, 
                book: serializeData(existingBook),
            }
        }

        return {
            exists: false,
        }

    } catch (e) {
        console.error('Error checking book exists', e);
        return {
            exists: false, error: e,
        }
    }
}

export const createBook = async (data: CreateBook) => {
    try {
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: "Unauthorized" };
        }

        await connectToDatabase();

        const slug = generateSlug(data.title)

        const existingBook = await Book.findOne({slug}).lean();

        if(existingBook) {
            return {
                success: true,
                data: serializeData(existingBook),
                alreadyExists: true,
            }
        }

        //Check subsription limits before creating a book

        const book = await Book.create({
            ...data,
            clerkId: userId,
            persona: data.persona || DEFAULT_VOICE,
            slug,
            totalSegments: 0,
        });

        return {
            success: true,
            data: serializeData(book),
        }

    } catch (e) {
        console.error('Error creating a book', e);
        return {
            success: false,
            error: e,
        }
    }
}

export const saveBookSegments = async (
    bookId: string,
    segments: TextSegment[]) => {
        let rollbackUserId: string | undefined;
        let rollbackBookId: string | undefined;

        try {
            const { userId } = await auth();
            if (!userId) {
                return { success: false, error: "Unauthorized" };
            }

            await connectToDatabase();

            const book = await Book.findOne({ _id: bookId, clerkId: userId });
            if (!book) {
                return { success: false, error: "Book not found" };
            }

            rollbackUserId = userId;
            rollbackBookId = bookId;
            console.log('Saving book segments...');

            const segmentsToInsert = segments.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
                clerkId: userId, bookId, content: text, segmentIndex, pageNumber, wordCount
            }));

            await BookSegment.insertMany(segmentsToInsert);
            await Book.findByIdAndUpdate(bookId, { totalSegments: segments.length });

            console.log('Book segments save succesfully')

            return {
                success: true,
                data: { segmentsCreated: segments.length}
            }

        } catch (e) {
            console.error('Error saving book segments', e);

            if (rollbackUserId && rollbackBookId) {
                try {
                    await BookSegment.deleteMany({ bookId: rollbackBookId, clerkId: rollbackUserId });
                } catch (cleanupError) {
                    console.error('Error deleting book segments during rollback', cleanupError);
                }

                try {
                    await Book.deleteOne({ _id: rollbackBookId, clerkId: rollbackUserId });
                } catch (cleanupError) {
                    console.error('Error deleting book during rollback', cleanupError);
                }
            }

            return {
                success: false,
                error: e,
            }
        }
}

export const getAllBooks = async () => {
    try {
        await connectToDatabase();

        const books = await Book.find().sort({ createdAt: -1 }).lean();

        return {
            success: true,
            books: serializeData(books)
        }
    } catch (e) {
        console.error('Error connecting to Database', e);
        return {
            success: false, error: e
        }
    }
}