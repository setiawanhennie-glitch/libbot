import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { DEFAULT_VOICE } from "@/lib/constants";
import { getBookBySlug } from "@/lib/actions/book.actions";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { slug } = await params;
  const result = await getBookBySlug(slug);

  if (!result.success) {
    throw new Error(result.error);
  }

  if (!result.data) {
    redirect("/");
  }

  const book = result.data;

  return (
    <main className="book-page-container">
      <Link href="/" className="back-btn-floating" aria-label="Back to library">
        <ArrowLeft aria-hidden="true" size={20} />
      </Link>

      <div className="vapi-main-container gap-6">
        <section className="vapi-header-card w-full rounded-xl" aria-labelledby="book-title">
          <div className="vapi-cover-wrapper">
            {book.coverURL ? (
              <Image
                src={book.coverURL}
                alt={`Cover of ${book.title}`}
                width={130}
                height={195}
                className="vapi-cover-image h-[180px] w-[120px]"
              />
            ) : (
              <div
                className="vapi-cover-image h-[180px] w-[120px] bg-[#fff6e5]"
                role="img"
                aria-label="Book cover unavailable"
              />
            )}
            <div className="vapi-mic-wrapper">
              <button
                type="button"
                className="vapi-mic-btn size-[60px]"
                aria-label="Start a conversation"
              >
                <MicOff aria-hidden="true" size={24} />
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1
              id="book-title"
              className="font-serif text-2xl font-bold text-[#212a3b] sm:text-3xl"
            >
              {book.title}
            </h1>
            <p className="mt-1 text-[#3d485e]">by {book.author}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="vapi-status-indicator rounded-full">
                <span className="vapi-status-dot vapi-status-dot-ready" />
                <span className="vapi-status-text">Ready</span>
              </div>
              <span className="rounded-full bg-white px-3 py-2 text-sm font-medium text-[#212a3b]">
                Voice: {book.persona ?? DEFAULT_VOICE}
              </span>
              <span className="rounded-full bg-white px-3 py-2 text-sm font-medium text-[#212a3b]">
                0:00/15:00
              </span>
            </div>
          </div>
        </section>

        <section className="transcript-container min-h-[400px]" aria-label="Conversation transcript">
          <div className="transcript-empty">
            <Mic aria-hidden="true" className="mb-4 size-12 text-[#3d485e]" />
            <p className="transcript-empty-text">No conversation yet</p>
            <p className="transcript-empty-hint">
              Click the mic button above to start talking
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
