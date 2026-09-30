<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { locale, switchLocale } from '$/i18n';
  import { createTranslator, nextLocale } from '$/i18n/translate';
  import TranslateIcon from '~icons/material-symbols/translate';

  // Labelled in the language it switches to, so someone who cannot read the
  // current UI language can still find the way out of it.
  const next = nextLocale(locale);
  const inNext = createTranslator(next);
</script>

<Button
  variant="ghost"
  size="sm"
  data-testid={TID.localeToggleButton}
  lang={next}
  title={inNext('toolbar.switchLocale')}
  aria-label={inNext('toolbar.switchLocale')}
  class="gap-1 px-2 [&_svg]:size-5"
  onclick={() => switchLocale(next)}>
  <TranslateIcon />
  {inNext('locale.name')}
</Button>
