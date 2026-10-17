'use server';

import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import { escapeRegex, generateSlug } from "@/lib/utils";
import { DEFAULT_VOICE } from "@/lib/constants";
import Book from "@/database/models/book.model";
import { serializeData } from "@/lib/utils";
import BookSegment from "@/database/models/book-segment.model";
import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { Types } from "mongoose";
import mongoose from "mongoose";

export const checkBookExists = async (title: string) => {
    try {
        const { userId } = await auth();
        if (!userId) {
            return { exists: false, error: "Unauthorized" };
        }

        await connectToDatabase();

        const slug = generateSlug(title);

        const existingBook = await Book.findOne({ clerkId: userId, slug }).lean();

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

        const existingBook = await Book.findOne({ clerkId: userId, slug }).lean();

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
            uploadPending: true,
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
        let insertedSegmentIds: Types.ObjectId[] = [];
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
                _id: new Types.ObjectId(),
                clerkId: userId,
                bookId,
                content: text,
                segmentIndex,
                pageNumber,
                wordCount,
            }));
            insertedSegmentIds = segmentsToInsert.map(({ _id }) => _id);

            await BookSegment.insertMany(segmentsToInsert);
            const updateResult = await Book.updateOne(
                { _id: bookId, clerkId: userId, uploadPending: true },
                { totalSegments: segments.length, uploadPending: false },
            );
            if (updateResult.modifiedCount !== 1) {
                throw new Error("Book upload is no longer pending");
            }

            console.log('Book segments save succesfully')

            return {
                success: true,
                data: { segmentsCreated: segments.length}
            }

        } catch (e) {
            console.error('Error saving book segments', e);

            if (rollbackUserId && rollbackBookId && insertedSegmentIds.length > 0) {
                try {
                    await BookSegment.deleteMany({
                        _id: { $in: insertedSegmentIds },
                        bookId: rollbackBookId,
                        clerkId: rollbackUserId,
                    });
                } catch (cleanupError) {
                    console.error('Error deleting book segments during rollback', cleanupError);
                }
            }

            return {
                success: false,
                error: e,
            }
        }
}

export const rollbackCreatedBook = async (bookId: string) => {
    try {
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: "Unauthorized" };
        }

        await connectToDatabase();

        const rolledBack = await Book.db.transaction(async (session) => {
            const pendingBook = await Book.findOne({
                _id: bookId,
                clerkId: userId,
                uploadPending: true,
            }).session(session);

            if (!pendingBook) return false;

            await BookSegment.deleteMany({ bookId, clerkId: userId }, { session });
            const result = await Book.deleteOne(
                { _id: bookId, clerkId: userId, uploadPending: true },
                { session },
            );
            if (result.deletedCount !== 1) {
                throw new Error("Pending book changed before rollback completed");
            }

            return true;
        });

        if (!rolledBack) {
            return { success: false, error: "Book is not a pending upload" };
        }

        return { success: true };
    } catch (e) {
        console.error('Error rolling back newly created book', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Unknown book rollback error",
        };
    }
}

export const deleteUploadedBlobs = async (pathnames: string[]) => {
    try {
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: "Unauthorized" };
        }

        const userPrefix = `${userId}/`;
        if (pathnames.some((pathname) => {
            if (!pathname.startsWith(userPrefix)) return true;
            const pathWithinUserFolder = pathname.slice(userPrefix.length);
            return !pathWithinUserFolder || pathWithinUserFolder.split("/").some((part) => part === "." || part === "..");
        })) {
            return { success: false, error: "Cannot delete blobs outside your upload folder" };
        }

        if (pathnames.length > 0) {
            await del(pathnames);
        }

        return { success: true };
    } catch (e) {
        console.error('Error deleting uploaded blobs', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Unknown blob deletion error",
        };
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

export const getBookBySlug = async (slug: string) => {
    try {
        const { userId } = await auth();
        if (!userId) {
            return { success: false, error: "Unauthorized" };
        }

        await connectToDatabase();

        const book = await Book.findOne({ slug })
            .select("title author coverURL persona")
            .lean();

        return {
            success: true,
            data: book
                ? serializeData({
                    _id: book._id.toString(),
                    title: book.title,
                    author: book.author,
                    coverURL: book.coverURL,
                    persona: book.persona,
                })
                : null,
        };
    } catch (e) {
        console.error("Error fetching book by slug", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Unknown book lookup error",
        };
    }
}

export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
    try {
        await connectToDatabase();

        console.log(`Searching for: "${query}" in book ${bookId}`);

        const bookObjectId = new mongoose.Types.ObjectId(bookId);

        // Try MongoDB text search first (requires text index)
        let segments: Record<string, unknown>[] = [];
        try {
            segments = await BookSegment.find({
                bookId: bookObjectId,
                $text: { $search: query },
            })
                .select('_id bookId content segmentIndex pageNumber wordCount')
                .sort({ score: { $meta: 'textScore' } })
                .limit(limit)
                .lean();
        } catch {
            // Text index may not exist — fall through to regex fallback
            segments = [];
        }

        // Fallback: regex search matching ANY keyword
        if (segments.length === 0) {
            const keywords = query.split(/\s+/).filter((k) => k.length > 2);
            const pattern = keywords.map(escapeRegex).join('|');

            segments = await BookSegment.find({
                bookId: bookObjectId,
                content: { $regex: pattern, $options: 'i' },
            })
                .select('_id bookId content segmentIndex pageNumber wordCount')
                .sort({ segmentIndex: 1 })
                .limit(limit)
                .lean();
        }

        console.log(`Search complete. Found ${segments.length} results`);

        return {
            success: true,
            data: serializeData(segments),
        };
    } catch (error) {
        console.error('Error searching segments:', error);
        return {
            success: false,
            error: (error as Error).message,
            data: [],
        };
    }
};