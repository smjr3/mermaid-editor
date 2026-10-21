<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { commandByKey } from '$/util/selectionCommands';
  import { selectionModel as model } from '$/util/selectionModel.svelte';

  // Local: the row 「同じものを選ぶ │ 同じ形 ・ 同じ色 ・ 同じレーン ・ 矢印すべて ・ ここから先」,
  // at the end of an object's or an arrow's rows and in the multi view: each button
  // replaces the selection with the registry's 「同じものを選ぶ」 choice for the primary
  // item (selectionCommands.ts `sameAs`); only the choices that fit are offered, and
  // the row is left out when none does.
  const command = commandByKey('selectSame');
  const choices = $derived(command.appliesTo(model) ? (command.choices?.(model) ?? []) : []);
</script>

{#if choices.length > 0}
  <FieldRow label={t('sel.cmd.selectSame')} testID={TID.inspSelectSameRow}>
    <div
      class="flex min-w-0 flex-wrap items-center gap-1"
      role="group"
      aria-label={t('sel.cmd.selectSame')}>
      {#each choices as choice (choice.value)}
        <button
          type="button"
          class="h-6 rounded-md border border-input bg-background px-1.5 text-xs whitespace-nowrap hover:bg-muted"
          data-value={choice.value}
          data-testid={TID.inspSelectSame}
          onclick={() => void command.run(model, choice.value)}
          >{choice.label ? t(choice.label) : choice.text}</button>
      {/each}
    </div>
  </FieldRow>
{/if}
