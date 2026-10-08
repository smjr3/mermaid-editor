<script lang="ts">
  import BracesIcon from '~icons/material-symbols/data-object-rounded';
  import PaletteIcon from '~icons/material-symbols/palette-outline';

  // Local: "diagram style code" — a palette beside braces — for the config (JSON) tab,
  // which is not a settings page of the site, so the gear it had misled.
  let { class: className = '' }: { class?: string } = $props();
</script>

<span class="inline-flex items-center {className}" aria-hidden="true">
  <PaletteIcon class="size-[0.9em]" />
  <BracesIcon class="-ml-0.5 size-[0.9em]" />
</span>
