import mongoose from 'mongoose';
import { migrateBookSlugIndex } from "@/database/migrations/book-slug-index";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) throw new Error('Please define the MONGODB_URI environment variable');

declare global {
    var mongooseCache: {
        conn: typeof mongoose | null
        promise: Promise<typeof mongoose> | null
        bookSlugIndexMigration: Promise<void> | null
    }
}

const cached = global.mongooseCache || (global.mongooseCache = {
    conn: null,
    promise: null,
    bookSlugIndexMigration: null,
});

export const connectToDatabase = async () => {
    if (!cached.conn && !cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, {
            bufferCommands: false
        });
    }

    try {
        if (!cached.conn) {
            cached.conn = await cached.promise!;
            console.info('Connected to MongoDB');
        }

        if (!cached.bookSlugIndexMigration) {
            cached.bookSlugIndexMigration = migrateBookSlugIndex().catch((error: unknown) => {
                cached.bookSlugIndexMigration = null;
                throw error;
            });
        }

        await cached.bookSlugIndexMigration;
        return cached.conn;
    } catch (e) {
        if (!cached.conn) {
            cached.promise = null;
            console.error('MongoDB connection error. Please make sure MongoDB is running.' + e);
        } else {
            console.error('Database initialization error.' + e);
        }
        throw e;
    }
}