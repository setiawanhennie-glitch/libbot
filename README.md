# LibBot

LibBot turns uploaded books into private, interactive reading experiences. Users can upload a PDF, optionally provide a cover image, choose a voice persona, and talk with an AI voice assistant that can search the uploaded book while the conversation is in progress.

## Features

- Clerk-powered sign up, sign in, and protected application routes.
- Personal library with title search.
- PDF upload and browser-side PDF text extraction.
- Automatic text segmentation with overlapping context for reliable book search.
- Optional custom cover image, with a generated cover fallback.
- Multiple ElevenLabs voice personas:
  - Dave
  - Daniel
  - Chris
  - Rachel
  - Sarah
- Real-time voice conversations powered by Vapi.
- Voice transcripts displayed during a session.
- Server-side book search tool for Vapi conversations.
- MongoDB full-text search over saved book segments.
- Monthly plan limits for books, voice sessions, and session duration.
- Clerk pricing table for subscription upgrades.
- Vercel Blob storage for PDF and cover assets.
- Quota locking and rollback logic to avoid duplicate books, over-quota sessions, and orphaned uploads.

## How it works

1. A signed-in user opens **Add a New Book** at `/books/new`.
2. The upload form validates the title, author, voice, PDF, and optional cover image.
3. The PDF is parsed with `pdfjs-dist` and divided into overlapping text segments.
4. The PDF and cover are uploaded to Vercel Blob.
5. Book metadata and searchable segments are stored in MongoDB.
6. The book appears in the user's private library at `/`.
7. Opening a book creates a quota-controlled voice session and starts a Vapi web call.
8. When the assistant needs information from the book, Vapi calls `/api/vapi/search-book`.
9. The API validates the Vapi request and book/session identifiers, searches the book's segments, and returns the most relevant matches to the assistant.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, shadcn/ui primitives, Lucide |
| Authentication | Clerk |
| Database | MongoDB with Mongoose |
| File storage | Vercel Blob |
| PDF processing | `pdfjs-dist` |
| Voice | Vapi Web SDK and Vapi API |
| Text-to-speech | ElevenLabs voices configured through Vapi |
| Validation | Zod and React Hook Form |
| Notifications | Sonner |

## Requirements

- Node.js 20.9 or newer
- npm
- A MongoDB deployment
- A Clerk application
- A Vercel Blob store
- A Vapi assistant and API credentials
- A Vapi server secret for the book-search webhook

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root. Do not commit this file.

```dotenv
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Vapi
NEXT_PUBLIC_ASSISTANT_ID=<vapi-assistant-id>
NEXT_PUBLIC_VAPI_API_KEY=<vapi-public-or-web-sdk-key>
VAPI_SERVER_SECRET=<vapi-server-webhook-secret>
```

`BLOB_STORE_ID` may also be present in a local Vercel Blob setup, but the application uploads through `BLOB_READ_WRITE_TOKEN`.

The public Vapi variables are consumed by the browser or used to identify the assistant. Keep `CLERK_SECRET_KEY`, `MONGODB_URI`, `BLOB_READ_WRITE_TOKEN`, and `VAPI_SERVER_SECRET` private. If any real credential has been exposed, revoke and rotate it before using the repository.

### 3. Configure external services

#### Clerk

1. Create a Clerk application.
2. Enable the sign-in and sign-up methods required by the project.
3. Set the application's sign-in and sign-up URLs to `/sign-in` and `/sign-up`.
4. Configure the `free`, `standard`, and `pro` plans if using the built-in subscription limits.
5. Set the Clerk keys in `.env.local`.

The Clerk middleware applies authentication handling to application and API requests. Individual pages and server actions still check the current user before accessing user-owned data.

#### MongoDB

Create a database user and allow the development machine or deployment platform to connect. The application connects lazily and runs the book slug index migration when the first database connection is established.

#### Vercel Blob

Create a Blob store and generate a read/write token. The upload route permits PDF files and JPEG, PNG, and WebP images. PDFs are limited to 50 MB and cover images to 10 MB.

#### Vapi

Create or configure an assistant with a tool named `search book` (case-insensitive matching is used). The tool should send:

- `bookId`: the MongoDB book ID
- `query`: the user's question or search phrase

Configure the assistant's server/tool webhook to call:

```text
POST /api/vapi/search-book
```

The request must include the configured server secret in the `Authorization` header. The assistant should preserve the `bookId` and `voiceSessionId` values supplied in `assistantOverrides.variableValues`.

## Running locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production-style local run:

```bash
npm run build
npm run start
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server after building |
| `npm run lint` | Run ESLint |

## Application routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public shell; library data is user-scoped | Display recent books and search by title |
| `/books/new` | Signed-in users | Upload a PDF, cover, metadata, and assistant voice |
| `/books/[slug]` | Signed-in users | Open a book and start a voice conversation |
| `/subscriptions` | Available from the application | Display Clerk plans and upgrade options |
| `/sign-in` | Public | Clerk sign-in flow |
| `/sign-up` | Public | Clerk sign-up flow |
| `/api/upload` | Authenticated upload flow | Generate authorized Vercel Blob upload tokens |
| `/api/vapi/search-book` | Vapi server only | Search book segments during a voice call |

## Plans and limits

The application currently defines these application-level limits in `lib/subscription-constants.ts`:

| Plan | Books | Voice sessions per billing period | Maximum session length | Session history |
| --- | ---: | ---: | ---: | --- |
| Free | 1 | 5 | 5 minutes | No |
| Standard | 10 | 100 | 15 minutes | Yes |
| Pro | 100 | Unlimited | 60 minutes | Yes |

For paid plans, the billing period is read from the active Clerk billing subscription. Free users use the current UTC calendar month. Book creation and session creation are protected by a per-user MongoDB quota lock.

The Clerk pricing configuration and the limits in the source code should be kept in sync when plans change.

## Project structure

```text
app/
  (root)/
    page.tsx                 # Library homepage and title search
    books/[slug]/page.tsx    # Book conversation page
    books/new/page.tsx       # Upload page
    subscriptions/page.tsx   # Clerk pricing table
  api/
    upload/route.ts          # Vercel Blob upload authorization
    vapi/search-book/route.ts   # Vapi book-search tool endpoint
  sign-in/                   # Clerk sign-in route
  sign-up/                   # Clerk sign-up route
components/
  BookCard.tsx               # Library book card
  UploadForm.tsx             # Upload and processing workflow
  VapiControls.tsx           # Voice controls and transcript UI
  Transcript.tsx             # Conversation transcript
  Navbar.tsx                 # Site navigation
  HeroSection.tsx            # Homepage hero
database/
  models/
    book.model.ts
    book-segment.model.ts
    voice-session.model.ts
    user-quota-lock.model.ts
  mongoose.ts                # Cached MongoDB connection
lib/
  actions/book.actions.ts    # Book CRUD, processing, and search actions
  actions/session.actions.ts # Voice session creation and completion
  quota-lock.ts              # Per-user quota reservation
  subscription.server.ts     # Clerk plan and billing-period lookup
  subscription-constants.ts  # Plans and limits
  utils.ts                   # PDF parsing, segmentation, and helpers
hooks/
  useVapi.ts                 # Client-side Vapi call lifecycle
proxy.ts                     # Clerk middleware configuration
```

## Data model

### `Book`

Stores user ownership, title, slug, author, selected voice persona, PDF and cover Blob references, file size, and upload-processing state. The `(clerkId, slug)` pair is unique, so two users may use the same title but one user cannot create duplicate titles.

### `BookSegment`

Stores extracted book text with its book ID, segment index, optional page number, and word count. A text index on `content` supports search, while indexes on book and segment/page fields support ordered retrieval.

### `VoiceSession`

Records the user, book, billing period, start/end timestamps, actual duration, and plan-derived maximum duration. Session reservations are created before a Vapi call and removed if call creation fails.

### `UserQuotaLock`

Provides a per-user coordination document used while checking book and voice-session quotas, preventing concurrent requests from bypassing limits.

## Upload and processing details

- Titles and author names are trimmed and limited to 100 characters.
- Only PDF files are accepted for book content.
- PDFs are limited to 50 MB.
- Cover images may be JPEG, JPG, PNG, or WebP and are limited to 10 MB.
- If no cover is selected, the first PDF page is used to generate a cover image.
- Extracted text is split into segments of up to 500 words with 50 words of overlap.
- Failed processing attempts clean up uploaded Blob objects and roll back pending database records where possible.
- Books remain marked as `uploadPending` until all segments have been saved successfully.

## Search and voice security

The Vapi search endpoint:

1. Compares the incoming authorization value using a timing-safe comparison.
2. Verifies the configured assistant ID.
3. Requires tool calls and validates the tool arguments.
4. Ensures the requested book ID matches the book attached to the call.
5. Requires a valid voice-session ID.
6. Returns only a small number of matching segments to the assistant.

Do not expose the Vapi server secret or database credentials to browser code. When deploying, set secrets through the hosting provider's environment settings rather than committing them to the repository.

## Deployment

The project is suitable for deployment to Vercel:

1. Import the repository into Vercel.
2. Set all required environment variables for the target environment.
3. Use production Clerk keys and production billing configuration.
4. Configure the production MongoDB network access rules.
5. Configure the Vercel Blob store and token.
6. Point the Vapi webhook/tool URL at the deployed `/api/vapi/search-book` endpoint.
7. Run a production build before enabling traffic:

   ```bash
   npm run build
   ```

The deployment must allow server-side access to MongoDB, Vercel Blob, Clerk, and Vapi. Ensure the configured Vercel image remote patterns match the Blob hostname used by the deployment.

## Troubleshooting

### `MONGODB_URI` errors

Confirm that `.env.local` exists, the variable is spelled correctly, the URI is valid, and the database allows the current IP or deployment network.

### Uploads fail

Check `BLOB_READ_WRITE_TOKEN`, the Blob store permissions, and the file size/type restrictions. Browser uploads also depend on `/api/upload` being reachable and the user being authenticated.

### Voice calls do not start

Check `NEXT_PUBLIC_VAPI_API_KEY`, `NEXT_PUBLIC_ASSISTANT_ID`, and the assistant configuration. The selected plan may also have reached its session count or duration limit.

### The assistant cannot answer from a book

Verify that the book finished processing (`uploadPending` is false and `totalSegments` is greater than zero), that the assistant uses the `search book` tool, and that the Vapi webhook points to `/api/vapi/search-book` with the correct server secret.

### Clerk redirects are incorrect

Verify the four Clerk URL variables and the corresponding Clerk dashboard configuration. The expected application paths are `/sign-in`, `/sign-up`, and `/`.

## Development notes

- Keep all user-owned database queries scoped by `clerkId`.
- Keep server-only secrets out of client components and `NEXT_PUBLIC_*` variables unless the value is intentionally public.
- Update both `PLAN_LIMITS` and Clerk billing plans when changing subscription behavior.
- Preserve the upload cleanup and rollback paths when changing book-processing code.
- Run lint and a production build before opening a pull request:

  ```bash
  npm run lint
  npm run build
  ```

## License

No license file is currently included in this repository. Add a license before distributing the project or accepting external contributions under defined terms.
