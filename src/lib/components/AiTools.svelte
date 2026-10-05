<script lang="ts">
  import AiIconPrompt from '$/components/AiIconPrompt.svelte';
  import Card from '$/components/Card/Card.svelte';
  import UnknownIcons from '$/components/UnknownIcons.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import AiIcon from '~icons/material-symbols/auto-awesome-outline-rounded';

  // Local: the 出す tab's "AI・アイコン確認" section — the icon names this diagram uses
  // that no pack has, with a replacement for each (UnknownIcons), and the briefing
  // to hand an AI with the icons collected in the Icons section (AiIconPrompt). Both
  // used to sit in the Icons card.
</script>

<Card title={t('ai.title')} testID={TID.aiCard} isStackable icon={{ component: AiIcon }}>
  <div class="flex min-w-fit flex-col gap-3 p-2 text-sm">
    <UnknownIcons />
    <AiIconPrompt />
  </div>
</Card>
