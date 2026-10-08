<script lang="ts">
  import { Button } from '$/components/ui/button';
  import * as Popover from '$/components/ui/popover';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { finishGuide, guide, hasSeenGuide, startGuide } from '$/util/onboarding.svelte';
  import { onMount } from 'svelte';

  // Local: the first-visit guide, three popovers that point at the tools pane, the
  // diagram and the header's help button. Closing it (the button or Escape) records
  // that it was seen; the How to use dialog can start it again.
  const steps = [
    {
      body: t('guide.step1.body'),
      selectors: [`[data-testid="${TID.toolsPane}"]`, `[data-testid="${TID.toolsRail}"]`, '#view'],
      side: 'left' as const,
      title: t('guide.step1.title')
    },
    {
      body: t('guide.step2.body'),
      selectors: ['#view'],
      side: 'bottom' as const,
      title: t('guide.step2.title')
    },
    {
      body: t('guide.step3.body'),
      selectors: [`[data-testid="${TID.helpButton}"]`],
      side: 'bottom' as const,
      title: t('guide.step3.title')
    }
  ];

  const step = $derived(steps[Math.min(guide.step, steps.length - 1)]);
  const isLast = $derived(guide.step >= steps.length - 1);

  type Side = 'bottom' | 'left' | 'right' | 'top';
  let anchor = $state<HTMLElement | { getBoundingClientRect: () => DOMRect } | null>(null);
  let side = $state<Side>('bottom');
  let rect = $state<DOMRect | null>(null);

  const visible = (element: Element | null): element is HTMLElement =>
    !!element && element.getBoundingClientRect().width > 0;

  // The popover's size (w-80, and about its tallest text) plus its offset and margin.
  const POPOVER = { height: 240, width: 344 };
  const opposite: Record<Side, Side> = {
    bottom: 'top',
    left: 'right',
    right: 'left',
    top: 'bottom'
  };
  const roomOn = (box: DOMRect, at: Side): boolean => {
    if (at === 'bottom') return window.innerHeight - box.bottom >= POPOVER.height;
    if (at === 'top') return box.top >= POPOVER.height;
    if (at === 'left') return box.left >= POPOVER.width;
    return window.innerWidth - box.right >= POPOVER.width;
  };

  /**
   * Where the popover goes: beside the target on the step's side, or the opposite one.
   * A target that leaves no room on either (the diagram fills the window's middle, so
   * "below the diagram" was off-screen) gets the popover inside it, near its top.
   */
  const place = (element: HTMLElement, box: DOMRect, preferred: Side) => {
    for (const at of [preferred, opposite[preferred]]) {
      if (roomOn(box, at)) {
        anchor = element;
        side = at;
        return;
      }
    }
    const point = () => {
      const now = element.getBoundingClientRect();
      const x = now.left + now.width / 2;
      const y = Math.max(now.top, 0) + 16;
      return new DOMRect(x, y, 0, 0);
    };
    anchor = { getBoundingClientRect: point };
    side = 'bottom';
  };

  const locate = () => {
    for (const selector of step.selectors) {
      const element = document.querySelector(selector);
      if (visible(element)) {
        // A local first: reading `rect` here would make the effect that calls this rerun.
        const box = element.getBoundingClientRect();
        rect = box;
        place(element, box, step.side);
        return;
      }
    }
    anchor = null;
    rect = null;
  };

  $effect(() => {
    if (!guide.open) return;
    // Re-read when the step changes; keep following the target while the window resizes.
    void guide.step;
    locate();
    window.addEventListener('resize', locate);
    return () => window.removeEventListener('resize', locate);
  });

  onMount(() => {
    if (hasSeenGuide()) return;
    // The panes lay themselves out on the first frames; point at them once they have.
    const timer = setTimeout(() => {
      if (!hasSeenGuide()) startGuide();
    }, 800);
    return () => clearTimeout(timer);
  });
</script>

{#if guide.open}
  {#if rect}
    <div
      class="pointer-events-none fixed z-40 rounded-md ring-2 ring-accent ring-offset-2 ring-offset-background"
      style:left="{rect.left}px"
      style:top="{rect.top}px"
      style:width="{rect.width}px"
      style:height="{rect.height}px">
    </div>
  {/if}
  <Popover.Root
    open
    onOpenChange={(open) => {
      if (!open) finishGuide();
    }}>
    <Popover.Content
      customAnchor={anchor}
      {side}
      avoidCollisions
      sticky="always"
      sideOffset={12}
      collisionPadding={12}
      trapFocus={false}
      class="w-80 max-w-[calc(100vw-1.5rem)]"
      data-testid={TID.guidePopover}
      onInteractOutside={(event) => event.preventDefault()}>
      <div class="flex flex-col gap-3" role="group" aria-label={step.title}>
        <p class="text-xs text-muted-foreground">
          {t('guide.progress', { current: String(guide.step + 1), total: String(steps.length) })}
        </p>
        <h2 class="font-semibold">{step.title}</h2>
        <p class="text-sm">{step.body}</p>
        <div class="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" data-testid={TID.guideClose} onclick={finishGuide}>
            {t('guide.close')}
          </Button>
          <div class="flex gap-2">
            {#if guide.step > 0}
              <Button size="sm" variant="outline" onclick={() => (guide.step -= 1)}>
                {t('guide.back')}
              </Button>
            {/if}
            {#if !isLast}
              <Button size="sm" data-testid={TID.guideNext} onclick={() => (guide.step += 1)}>
                {t('guide.next')}
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </Popover.Content>
  </Popover.Root>
{/if}
