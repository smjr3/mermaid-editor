<script lang="ts">
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import { t } from '$/i18n';
  import type { Swatch } from '$/util/colors';

  // Local: superseded by the inspector's ColorRow.svelte; kept only as a thin wrapper
  // for the mini toolbar and the right-click menu until they stop importing it (the
  // canvas stream removes both), then this file goes.
  type Props =
    | {
        mode: 'fill';
        current: Swatch | undefined;
        onpick: (swatch: Swatch | undefined) => void;
        testID: string;
        compact?: boolean;
      }
    | {
        mode: 'line';
        current: string | undefined;
        onpick: (color: string | undefined) => void;
        testID: string;
        compact?: boolean;
      };
  let props: Props = $props();
</script>

{#if props.mode === 'fill'}
  <ColorRow
    mode="fill"
    current={props.current}
    onpick={props.onpick}
    testID={props.testID}
    label={t('sel.color')} />
{:else}
  <ColorRow
    mode="line"
    current={props.current}
    onpick={props.onpick}
    testID={props.testID}
    label={t('sel.color')} />
{/if}
