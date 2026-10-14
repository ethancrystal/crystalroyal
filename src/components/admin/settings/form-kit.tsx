"use client";

import { createContext, useActionState, useContext, type ComponentProps, type ReactNode } from "react";
import { isPlaceholder } from "@/lib/site";
import { CheckboxField, Field, Notice } from "../ui";
import { EMPTY_FORM_STATE, type FormAction, type FormState } from "./form-state";

// A server-action form for the console settings and calendar. ActionForm owns the useActionState; the fields inside
// (rendered by Server Components) read the result from context: their error is linked with aria-describedby and,
// after a refusal, they show what the owner typed instead of the stored value. FormNotice shows "Saved." or
// "Not saved." with the message, re-announced on every response.

const StateContext = createContext<FormState>(EMPTY_FORM_STATE);

export function useFormResult(): FormState {
  return useContext(StateContext);
}

/** For forms that run their own useActionState (the bank review): feeds FormField and FormNotice. */
export const FormResultProvider = StateContext.Provider;

export function ActionForm({
  action,
  children,
  className = "",
  notice = "top",
  ...rest
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** where the result notice sits; "none" when the form places <FormNotice /> itself */
  notice?: "top" | "bottom" | "none";
} & Omit<ComponentProps<"form">, "action" | "children" | "className">) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  return (
    <StateContext.Provider value={state}>
      <form action={formAction} className={className} noValidate {...rest}>
        {notice === "top" ? <FormNotice /> : null}
        {children}
        {notice === "bottom" ? <FormNotice /> : null}
      </form>
    </StateContext.Provider>
  );
}

export function FormNotice({ className = "" }: { className?: string }) {
  const state = useFormResult();
  if (state.ok) {
    return (
      <Notice key={state.nonce} tone="ok" className={className}>
        {state.ok}
      </Notice>
    );
  }
  if (state.error) {
    return (
      <Notice key={state.nonce} tone="bad" className={className}>
        {state.error}
      </Notice>
    );
  }
  return null;
}

/**
 * A one-button form inside a table row (move, hide, delete): a refusal shows as a short line under the button; a
 * success is announced to screen readers only, since the table itself shows the change.
 */
export function RowActionForm({
  action,
  children,
  className = "",
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  return (
    <StateContext.Provider value={state}>
      <form action={formAction} className={className}>
        {children}
        <span role="status" className="sr-only" key={`ok-${state.nonce}`}>
          {state.ok ?? ""}
        </span>
        {state.error ? (
          <span role="alert" key={`err-${state.nonce}`} className="err block text-[13px]">
            {state.error}
          </span>
        ) : null}
      </form>
    </StateContext.Provider>
  );
}

type FieldProps = ComponentProps<typeof Field>;

/** Field (ui.tsx) wired to the surrounding ActionForm. `placeholderValue` marks a stored [bracketed] value. */
export function FormField(props: FieldProps & { placeholderValue?: boolean }) {
  const state = useFormResult();
  const { placeholderValue, ...fieldProps } = props;
  const error = state.fieldErrors?.[props.name] ?? props.error ?? null;
  const echoed = state.values?.[props.name];
  // After a refusal the field shows what was typed, so the placeholder marking follows that value.
  const marked = placeholderValue === undefined ? false : echoed !== undefined ? isPlaceholder(echoed) : placeholderValue;
  const extra = marked ? "border-dashed! border-bad! text-bad!" : "";
  const inputClassName = `${props.inputClassName ?? ""} ${extra}`;
  if (echoed !== undefined) {
    return <Field {...(fieldProps as FieldProps)} error={error} defaultValue={echoed} inputClassName={inputClassName} />;
  }
  return <Field {...(fieldProps as FieldProps)} error={error} inputClassName={inputClassName} />;
}

/** CheckboxField wired to the surrounding ActionForm. */
export function FormCheckbox(props: ComponentProps<typeof CheckboxField>) {
  const state = useFormResult();
  const error = state.fieldErrors?.[props.name] ?? props.error ?? null;
  if (state.values) {
    return <CheckboxField {...props} error={error} defaultChecked={state.values[props.name] === "on"} />;
  }
  return <CheckboxField {...props} error={error} />;
}
