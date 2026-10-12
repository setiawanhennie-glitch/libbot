import Book from "@/database/models/book.model";

export const migrateBookSlugIndex = async () => {
  await Book.collection.createIndex(
    { clerkId: 1, slug: 1 },
    { unique: true, name: "clerkId_1_slug_1" },
  );

  const indexes = await Book.collection.listIndexes().toArray();
  const legacySlugIndex = indexes.find((index) => {
    const keys = Object.entries(index.key);
    return keys.length === 1 && keys[0][0] === "slug" && keys[0][1] === 1 && index.unique;
  });

  if (legacySlugIndex?.name) {
    await Book.collection.dropIndex(legacySlugIndex.name);
    console.info("Removed the legacy global unique book slug index");
  }
};
