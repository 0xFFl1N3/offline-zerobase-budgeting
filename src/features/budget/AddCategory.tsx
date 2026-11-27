import { useRef, useState } from 'react';
import type { GoalDraft } from '../../engine/types.ts';
import { t } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { useAction } from '../errors/useAction.ts';
import { Form } from '../../components/Form.tsx';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { useGoalFields } from './GoalFields.tsx';

/**
 * "+ Add category": a name field, and next to it "Add goal", which opens the goal's fields below. Enter or the button
 * then creates the category together with its goal.
 */
export function AddCategory({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-sky-700 hover:underline">
        + {t('budget.addCategory')}
      </button>
    );
  }
  // A form of its own, so every opening starts empty.
  return <AddCategoryForm groupId={groupId} onClose={() => setOpen(false)} />;
}

function AddCategoryForm({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const addCategory = useBudgetStore((s) => s.addCategory);
  const [name, setName] = useState('');
  const [withGoal, setWithGoal] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);
  const { fields, build } = useGoalFields();
  const { run, error, setError } = useAction();

  const submit = () => {
    if (!name.trim()) return setError(withGoal ? t('budget.errorCategoryName') : null);
    let draft: GoalDraft | undefined;
    if (withGoal) {
      const result = build('', '');
      if (!result.ok) return setError(result.error);
      const { id: _id, categoryId: _categoryId, ...rest } = result.goal;
      draft = rest;
    }
    void run(() => addCategory(groupId, name, draft)).then((ok) => ok && onClose());
  };

  const link = 'text-sm hover:underline';
  return (
    <Form
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      // Leaving the name field closes it, as before; once goal fields are open, typed values are kept.
      onBlur={(e) => {
        if (!withGoal && !e.currentTarget.contains(e.relatedTarget as Node | null)) onClose();
      }}
      className={withGoal ? 'flex flex-wrap items-end gap-3 rounded bg-slate-50 p-3' : 'flex flex-wrap items-center gap-3'}
    >
      <input {...NO_AUTOFILL}
        ref={nameField}
        autoFocus
        value={name}
        placeholder={t('budget.categoryName')}
        aria-label={t('budget.categoryName')}
        onChange={(e) => setName(e.target.value)}
        className="rounded border border-sky-500 px-2 py-1 text-sm focus:outline-none"
      />
      {!withGoal && (
        <button
          type="button"
          // Keeps the focus in the name field, so the blur above does not close the form first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setWithGoal(true)}
          className={`${link} text-sky-700`}
        >
          + {t('budget.addGoal')}
        </button>
      )}
      {withGoal && (
        <>
          <span className="w-full" />
          {fields}
          <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700">{t('budget.createCategory')}</button>
          <button type="button" onClick={() => {
              // Back to the name field, which also keeps Esc and leaving the field working as before.
              setWithGoal(false);
              nameField.current?.focus();
            }} className={`${link} text-slate-600`}>{t('budget.noGoal')}</button>
          <button type="button" onClick={onClose} className={`${link} text-slate-600`}>{t('common.cancel')}</button>
        </>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </Form>
  );
}
