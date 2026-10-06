"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { FileText, Image as ImageIcon, LoaderCircle, Upload, X } from "lucide-react"
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES,
  DEFAULT_VOICE,
  MAX_FILE_SIZE,
  voiceCategories,
  voiceOptions,
} from "@/lib/constants"
import { UploadSchema } from "@/lib/zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import type { BookUploadFormValues } from "@/types"

type UploadFormProps = {
  onSubmit?: (values: BookUploadFormValues) => void | Promise<void>
}

type UploadFieldProps = {
  id: string
  file?: File
  accept: string
  icon: typeof Upload
  prompt: string
  hint: string
  onFileChange: (file?: File) => void
  onBlur: () => void
  inputRef: (instance: HTMLInputElement | null) => void
}

const UploadField = ({
  id,
  file,
  accept,
  icon: Icon,
  prompt,
  hint,
  onFileChange,
  onBlur,
  inputRef,
}: UploadFieldProps) => {
  const handleFile = (selectedFile?: File) => {
    if (selectedFile) {
      onFileChange(selectedFile)
    }
  }

  return (
    <div>
      {file ? (
        <div className="upload-dropzone upload-dropzone-uploaded border-2 border-dashed border-[#c9b9a4] px-5">
          <FileText className="upload-dropzone-icon" aria-hidden="true" />
          <span className="upload-dropzone-text max-w-full truncate px-3">{file.name}</span>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-sm text-[#663820] underline underline-offset-2"
            onClick={() => onFileChange(undefined)}
            aria-label={`Remove ${file.name}`}
          >
            <X className="upload-dropzone-remove" aria-hidden="true" />
            Remove file
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="upload-dropzone border-2 border-dashed border-[#c9b9a4] px-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            handleFile(event.dataTransfer.files[0])
          }}
        >
          <Icon className="upload-dropzone-icon" aria-hidden="true" />
          <span className="upload-dropzone-text">{prompt}</span>
          <span className="upload-dropzone-hint">{hint}</span>
          <input
            ref={inputRef}
            id={id}
            className="sr-only"
            type="file"
            accept={accept}
            onBlur={onBlur}
            onChange={(event) => {
              handleFile(event.currentTarget.files?.[0])
              event.currentTarget.value = ""
            }}
          />
        </label>
      )}
      <p className="sr-only" id={`${id}-file-hint`}>
        {hint}
      </p>
    </div>
  )
}

const LoadingOverlay = () => (
  <div className="loading-wrapper" role="status" aria-live="polite">
    <div className="loading-shadow-wrapper bg-[var(--bg-card)] shadow-xl">
      <div className="loading-shadow">
        <LoaderCircle className="loading-animation size-12 text-[#663820]" aria-hidden="true" />
        <p className="loading-title">Preparing your book</p>
        <p className="text-center text-sm text-[var(--text-muted)]">
          Your details are being checked.
        </p>
      </div>
    </div>
  </div>
)

const voiceGroups = [
  { label: "Male Voices", names: voiceCategories.male },
  { label: "Female Voices", names: voiceCategories.female },
] as const

const UploadForm = ({ onSubmit }: UploadFormProps) => {
  const [submissionMessage, setSubmissionMessage] = useState("")
  const form = useForm<z.infer<typeof UploadSchema>>({
    resolver: zodResolver(UploadSchema),
    defaultValues: {
      pdfFile: undefined,
      coverImage: undefined,
      title: "",
      author: "",
      voice: DEFAULT_VOICE,
    },
  })

  const submitForm = async (values: BookUploadFormValues) => {
    setSubmissionMessage("")
    try {
      if (onSubmit) {
        await onSubmit(values)
        setSubmissionMessage("Your book details were submitted.")
      } else {
        setSubmissionMessage("Your details are valid. Book processing is not connected yet.")
      }
    } catch (error) {
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "We couldn't submit your book details. Please try again.",
      )
    }
  }

  return (
    <div className="new-book-wrapper">
      {form.formState.isSubmitting && <LoadingOverlay />}
      <Form {...form}>
        <form
          className="space-y-8"
          noValidate
          onSubmit={form.handleSubmit(submitForm)}
        >
          <FormField
            control={form.control}
            name="pdfFile"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="form-label" htmlFor="pdf-file">
                  PDF file
                </FormLabel>
                <UploadField
                  id="pdf-file"
                  file={field.value}
                  accept={ACCEPTED_PDF_TYPES.join(",")}
                  icon={Upload}
                  prompt="Click to upload PDF"
                  hint={`PDF file (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`}
                  onFileChange={(file) => {
                    field.onChange(file)
                    void form.trigger("pdfFile")
                  }}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                />
                <FormMessage className="mt-2 text-sm text-red-700" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="coverImage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="form-label" htmlFor="cover-image">
                  Cover image
                </FormLabel>
                <UploadField
                  id="cover-image"
                  file={field.value}
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  icon={ImageIcon}
                  prompt="Click to upload cover image"
                  hint="Leave empty to auto-generate from PDF"
                  onFileChange={(file) => {
                    field.onChange(file)
                    void form.trigger("coverImage")
                  }}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                />
                <FormMessage className="mt-2 text-sm text-red-700" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="form-label">Title</FormLabel>
                <FormControl>
                  <input
                    {...field}
                    className="form-input"
                    placeholder="ex: Rich Dad Poor Dad"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage className="mt-2 text-sm text-red-700" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="author"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="form-label">Author Name</FormLabel>
                <FormControl>
                  <input
                    {...field}
                    className="form-input"
                    placeholder="ex: Robert Kiyosaki"
                    autoComplete="name"
                  />
                </FormControl>
                <FormMessage className="mt-2 text-sm text-red-700" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="voice"
            render={({ field }) => (
              <FormItem>
                <fieldset className="space-y-5">
                  <legend className="form-label">Choose Assistant Voice</legend>
                  {voiceGroups.map(({ label, names }) => (
                    <div key={label} className="space-y-3">
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">
                        {label}
                      </p>
                      <div className="voice-selector-options flex-col">
                        {names.map((name) => {
                          const voice = voiceOptions[name]
                          const selected = field.value === name
                          return (
                            <label
                              key={voice.id}
                              className={`voice-selector-option ${
                                selected
                                  ? "voice-selector-option-selected"
                                  : "voice-selector-option-default"
                              }`}
                            >
                              <input
                                ref={selected ? field.ref : undefined}
                                type="radio"
                                name={field.name}
                                value={name}
                                checked={selected}
                                onChange={() => field.onChange(name)}
                                onBlur={field.onBlur}
                                className="sr-only"
                              />
                              <span className="flex w-full items-center justify-between gap-4 text-left">
                                <span className="font-semibold text-[#663820]">{voice.name}</span>
                                <span className="text-sm text-[var(--text-muted)]">
                                  {voice.description}
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </fieldset>
                <FormDescription className="sr-only">
                  Choose one assistant voice for your book.
                </FormDescription>
                <FormMessage className="mt-2 text-sm text-red-700" />
              </FormItem>
            )}
          />

          <button className="form-btn" type="submit" disabled={form.formState.isSubmitting}>
            Begin Synthesis
          </button>
          {submissionMessage && (
            <p className="text-sm text-[var(--text-secondary)]" role="status">
              {submissionMessage}
            </p>
          )}
        </form>
      </Form>
    </div>
  )
}

export default UploadForm