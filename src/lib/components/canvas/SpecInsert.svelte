<script lang="ts">
  import AddActionForm from '$/components/canvas/AddActionForm.svelte';
  import InsertItems, { type InsertEntry } from '$/components/canvas/InsertItems.svelte';
  import { t } from '$/i18n';
  import {
    checkAdd,
    initialValues,
    specFor,
    type Action,
    type AddSpec,
    type Field,
    type Values
  } from '$/util/addActions';
  import { codeHealth } from '$/util/codeHealth.svelte';
  import type { DiagramObject } from '$/util/mermaid';
  import { settledState } from '$/util/settledState.svelte';
  import { inputState, updateCode } from '$/util/state.svelte';

  // Local: the add bar for the diagram types listed in addActions.ts and chartEdit.ts — one
  // button per action (a participant, a message, a task, …), each opening its form in a
  // popover; past the fifth, under その他. The forms' values live here, so they survive a
  // popover closing, and an add fills in what should follow (the new participant as the
  // next message's receiver). Mounted per diagram type (keyed by the spec's kind).
  let { spec }: { spec: AddSpec } = $props();

  let parts = $state<Record<string, DiagramObject[]>>({});
  $effect(() => {
    const { code, error } = settledState.current;
    // The lists of another type's diagram (the one open before this) are none of this
    // type's; a broken code keeps the lists of the last valid one.
    if (specFor(code)?.kind !== spec.kind) {
      parts = {};
      return;
    }
    if (error) return;
    let stale = false;
    void spec.parts(code).then((found) => {
      if (!stale) parts = found;
    });
    return () => {
      stale = true;
    };
  });

  // Each action's form keeps its values while the diagram type stays the same.
  let values = $state<Record<string, Values>>({});
  let message = $state('');
  const current = (action: Action): Values => values[action.id] ?? initialValues(action);

  // Whole-object updates, so every form sees the change.
  const set = (action: Action, key: string, value: string) => {
    values = { ...values, [action.id]: { ...current(action), [key]: value } };
  };

  // Some actions only make sense for some diagrams (the first topic of an empty mindmap).
  const shown = $derived(spec.actions.filter((action) => action.when?.(parts) ?? true));

  // A connection is named from the two ids it joins (`c1 → c3`); say what they are called.
  const friendlyName = (action: Action, now: Values, name: string) => {
    const from = action.fields.find((field) => field.key === 'from');
    const to = action.fields.find((field) => field.key === 'to');
    if (!from || !to || name !== `${now.from} → ${now.to}`) return name;
    const called = (field: Field, id: string) =>
      (parts[field.source ?? ''] ?? []).find((part) => part.id === id)?.label.trim() || id;
    return `${called(from, now.from)} → ${called(to, now.to)}`;
  };

  const run = async (action: Action) => {
    const now = { ...current(action) };
    // A choice the diagram no longer has (the part was deleted in the code) is no choice.
    for (const field of action.fields) {
      if (field.kind !== 'item' || !now[field.key]) continue;
      const known = (parts[field.source ?? ''] ?? []).some(({ id }) => id === now[field.key]);
      if (!known) now[field.key] = '';
    }
    const before = inputState.code;
    const result = action.apply(before, now);
    if ('error' in result) {
      message = t(result.error);
      return;
    }
    // Written only if mermaid still reads it as the same type of diagram.
    if (!(await checkAdd(before, result.code)) || inputState.code !== before) {
      // Local: broken code is only added to when that makes it parse (the first topic
      // of an empty mindmap); otherwise say why (codeHealth.svelte.ts).
      message = codeHealth.broken ? t('recover.blocked') : t('add.breaks');
      return;
    }
    updateCode(result.code, { updateDiagram: true });
    message = result.done
      ? t(result.done)
      : t('add.done', { name: friendlyName(action, now, result.name) });
    // Clear what was typed; keep the choices, then apply what should follow.
    const cleared = Object.fromEntries(
      action.fields.map((field) => [
        field.key,
        field.kind === 'text' || field.reset ? (field.initial ?? '') : (now[field.key] ?? '')
      ])
    );
    values = { ...values, [action.id]: cleared };
    for (const other of spec.actions) {
      for (const [key, value] of Object.entries(result.follow ?? {})) {
        if (other.fields.some((field) => field.key === key)) set(other, key, value);
      }
    }
  };

  // The bar shows a title without its explanation in brackets (「枠（条件分岐・繰り返し）」→「枠」);
  // the form's title and the button's tooltip keep it whole.
  const short = (title: string) => title.replace(/\s*[（(][^）)]*[）)]\s*$/, '') || title;
  const entries = $derived<InsertEntry[]>(
    shown.map((action) => ({
      form: true,
      key: action.id,
      label: short(t(action.title)),
      title: t(action.title)
    }))
  );
</script>

<InsertItems {entries}>
  {#snippet form(key)}
    {@const action = shown.find((candidate) => candidate.id === key)}
    {#if action}
      <AddActionForm
        {action}
        {parts}
        {message}
        values={current(action)}
        onchange={(field, value) => set(action, field, value)}
        onsubmit={() => void run(action)} />
    {/if}
  {/snippet}
</InsertItems>
