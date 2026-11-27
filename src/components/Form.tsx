import type { FormEvent, FormHTMLAttributes } from 'react';

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'action' | 'method'> & {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

/**
 * Every form in the app. It always stops the browser's own submit, which would reload the page and put the
 * fields' values into the address bar (fields have a name, see noAutofill.ts). A test keeps plain <form> out.
 */
export function Form({ onSubmit, ...rest }: Props) {
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e);
      }}
    />
  );
}
