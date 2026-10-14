// What every settings and calendar server action returns to its form (useActionState). Isomorphic: imported by
// the client form kit and by the server actions.

export interface FormState {
  /** success message, shown after "Saved." */
  ok?: string;
  /** refusal message, shown after "Not saved." */
  error?: string;
  /** per-field messages, keyed by the input's name */
  fieldErrors?: Record<string, string>;
  /** the submitted values, echoed after a refusal so the form keeps what was typed */
  values?: Record<string, string>;
  /** changes on every response, so the same message is announced again */
  nonce?: number;
}

export const EMPTY_FORM_STATE: FormState = {};

export type FormAction = (prev: FormState, form: FormData) => Promise<FormState>;
