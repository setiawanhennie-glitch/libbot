import HeroSection from '@/components/HeroSection';
import BookCard from '@/components/BookCard';
import { getAllBooks } from '@/lib/actions/book.actions';
import Search from '@/components/Search';

type PageProps = {
  searchParams: Promise<{ query?: string }>;
};

const Page = async ({ searchParams }: PageProps) => {
  const { query } = await searchParams;

  const bookResults = await getAllBooks();
  const allBooks = bookResults.success ? bookResults.books ?? [] : [];

  const q = query?.trim().toLowerCase() ?? '';
  const books = q
    ? allBooks.filter((book) => book.title.toLowerCase().includes(q))
    : allBooks;

  return (
    <main className="wrapper container ">
      <HeroSection />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
        <h2 className="text-3xl font-serif font-bold text-[#212a3b]">
          {q ? `Results for "${query?.trim()}"` : 'Recent Books'}
        </h2>
        <Search />
      </div>

      {books.length > 0 ? (
        <div className="library-books-grid">
          {books.map((book) => (
            <BookCard
              key={book._id}
              title={book.title}
              author={book.author}
              coverURL={book.coverURL}
              slug={book.slug}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-[var(--text-muted)] py-16">
          No books found{q ? ` matching "${query?.trim()}"` : ''}. Try a different search.
        </p>
      )}
    </main>
  );
};

export default Page;