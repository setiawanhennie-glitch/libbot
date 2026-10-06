"use client"

import * as React from "react"
import {
  Controller,
  FormProvider,
  useFormContext,
  type UseFormReturn,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

type FormFieldContextValue = {
  name: FieldPath<FieldValues>
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)
const FormItemContext = React.createContext<string | null>(null)

function Form<TFieldValues extends FieldValues>({
  children,
  ...methods
}: UseFormReturn<TFieldValues> & { children: React.ReactNode }) {
  return <FormProvider {...methods}>{children}</FormProvider>
}

function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemId = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext || !itemId) {
    throw new Error("Form field components must be used inside FormField and FormItem.")
  }

  const fieldState = getFieldState(fieldContext.name, formState)

  return {
    controlId: `${itemId}-control`,
    descriptionId: `${itemId}-description`,
    messageId: `${itemId}-message`,
    error: fieldState.error,
  }
}

function FormItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={id}>
      <div data-slot="form-item" className={className} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  htmlFor,
  ...props
}: React.ComponentProps<"label">) {
  const { controlId } = useFormField()

  return (
    <label
      data-slot="form-label"
      htmlFor={htmlFor ?? controlId}
      className={className}
      {...props}
    />
  )
}

type FormControlProps = {
  children: React.ReactElement<{
    id?: string
    "aria-describedby"?: string
    "aria-invalid"?: boolean
  }>
}

function FormControl({ children }: FormControlProps) {
  const { controlId, messageId, error } = useFormField()
  const describedBy = error ? messageId : undefined

  return React.cloneElement(children, {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": Boolean(error),
  })
}

function FormDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { descriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={descriptionId}
      className={className}
      {...props}
    />
  )
}

function FormMessage({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  const { error, messageId } = useFormField()
  const message = error?.message ?? children

  if (!message) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={messageId}
      role="alert"
      className={className}
      {...props}
    >
      {message}
    </p>
  )
}

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage }
