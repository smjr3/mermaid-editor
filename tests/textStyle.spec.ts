import { TID } from '$/constants';
import { expect, t, test } from './test';

type Page = import('@playwright/test').Page;

const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;

const storedCode = async (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code
  );

// The computed style of the drawn text, as the browser applies it.
const labelStyle = (page: Page, text: string) =>
  page.evaluate((label) => {
    const element = [...document.querySelectorAll('#view svg *')].find(
      (candidate) => candidate.children.length === 0 && candidate.textContent?.trim() === label
    );
    if (!element) return undefined;
    const style = getComputedStyle(element);
    return { color: style.color, size: style.fontSize, weight: style.fontWeight };
  }, text);

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

test.describe('Text styling in the Colours card', () => {
  test('makes a flowchart node bold, larger and red in one style statement, then resets it', async ({
    editPage,
    page
  }) => {
    const code = 'flowchart TD\n  A[Alpha] --> B[Beta]';
    await editPage.start(urlFor(code));
    await editPage.checkTextInView('Alpha');
    await page.getByTestId(TID.colorsCard).click();
    await page.getByTestId(TID.colorsNodeSelect).selectOption('A');

    await page.getByTestId(TID.colorsTextBold).click();
    await expect.poll(() => storedCode(page)).toBe(`${code}\n  style A font-weight:bold`);
    await expect.poll(() => labelStyle(page, 'Alpha')).toMatchObject({ weight: '700' });
    await expect(page.getByTestId(TID.colorsTextBold)).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId(TID.colorsTextSize).selectOption('xlarge');
    await expect
      .poll(() => storedCode(page))
      .toBe(`${code}\n  style A font-weight:bold,font-size:24px`);
    await expect
      .poll(() => labelStyle(page, 'Alpha'))
      .toMatchObject({ size: '24px', weight: '700' });

    await page.getByTestId(`${TID.colorsTextColor}-#d64545`).click();
    await expect
      .poll(() => storedCode(page))
      .toBe(`${code}\n  style A color:#d64545,font-weight:bold,font-size:24px`);
    await expect.poll(() => labelStyle(page, 'Alpha')).toMatchObject({ color: rgb('#d64545') });

    // A fill joins the same statement and keeps the chosen text colour.
    await page.getByTestId(`${TID.colorsNode}-green`).click();
    await expect
      .poll(() => storedCode(page))
      .toBe(
        `${code}\n  style A fill:#def5e1,stroke:#3f9b52,color:#d64545,font-weight:bold,font-size:24px`
      );

    // Bold is a toggle.
    await page.getByTestId(TID.colorsTextBold).click();
    await expect
      .poll(() => storedCode(page))
      .toBe(`${code}\n  style A fill:#def5e1,stroke:#3f9b52,color:#d64545,font-size:24px`);
    await expect(page.getByTestId(TID.colorsTextBold)).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId(TID.colorsTextReset).click();
    await expect
      .poll(() => storedCode(page))
      .toBe(`${code}\n  style A fill:#def5e1,stroke:#3f9b52`);
    await expect.poll(() => labelStyle(page, 'Alpha')).toMatchObject({ weight: '400' });
    expect((await labelStyle(page, 'Alpha'))?.size).not.toBe('24px');
  });

  // mermaid honours font-weight and font-size in a style statement for every one of these.
  for (const { code, id, kind, lead = '', text } of [
    {
      code: 'swimlane-beta LR\n  subgraph L1\n    A[Alpha] --> B[Beta]\n  end',
      id: 'A',
      kind: 'swimlane',
      text: 'Alpha'
    },
    {
      code: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy',
      id: 'Idle',
      kind: 'state',
      text: 'Idle'
    },
    {
      // The class title is bold already; a member shows the change. The class
      // grammar needs a property without a hyphen first (see colors.ts).
      code: 'classDiagram\n  class Animal {\n    +name\n  }\n  Animal <|-- Dog',
      id: 'Animal',
      kind: 'class',
      lead: 'opacity:1,',
      text: '+name'
    },
    {
      code: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
      id: 'ORDER',
      kind: 'er',
      text: 'ORDER'
    },
    {
      code: 'requirementDiagram\n  requirement r1 {\n    id: 1\n    text: the text\n    risk: high\n    verifymethod: test\n  }\n  element e1 {\n    type: simulation\n  }\n  e1 - satisfies -> r1',
      id: 'r1',
      kind: 'requirement',
      text: 'r1'
    },
    {
      code: 'block-beta\n  columns 2\n  a["Alpha"] b["Beta"]',
      id: 'a',
      kind: 'block',
      text: 'Alpha'
    }
  ]) {
    test(`renders bold, larger text in a ${kind} diagram`, async ({ editPage, page }) => {
      await editPage.start(urlFor(code));
      await editPage.checkTextInView(text);
      await page.getByTestId(TID.colorsCard).click();
      await page.getByTestId(TID.colorsNodeSelect).selectOption(id);

      await page.getByTestId(TID.colorsTextBold).click();
      await page.getByTestId(TID.colorsTextSize).selectOption('large');
      await expect
        .poll(() => storedCode(page))
        .toBe(`${code}\n  style ${id} ${lead}font-weight:bold,font-size:18px`);
      await expect
        .poll(() => labelStyle(page, text))
        .toMatchObject({ size: '18px', weight: '700' });

      await page.getByTestId(TID.colorsTextReset).click();
      await expect.poll(() => storedCode(page)).toBe(code);
    });
  }

  test('offers C4 elements a text colour only', async ({ editPage, page }) => {
    const code = 'C4Context\n  Person(a, "Alice")\n  System(s, "Shop")';
    await editPage.start(urlFor(code));
    await editPage.checkTextInView('Shop');
    await page.getByTestId(TID.colorsCard).click();
    await page.getByTestId(TID.colorsNodeSelect).selectOption('s');

    await expect(page.getByText(t('colors.textC4'))).toBeVisible();
    await expect(page.getByTestId(TID.colorsTextBold)).toHaveCount(0);
    await expect(page.getByTestId(TID.colorsTextSize)).toHaveCount(0);

    await page.getByTestId(`${TID.colorsTextColor}-#d64545`).click();
    await expect
      .poll(() => storedCode(page))
      .toBe(`${code}\n  UpdateElementStyle(s, $fontColor="#d64545")`);
    // The colour reaches the drawing (C4 writes text as SVG text, filled).
    await expect
      .poll(() =>
        page.evaluate(
          (red) =>
            [...document.querySelectorAll('#view svg text, #view svg text *')].some((element) => {
              const style = getComputedStyle(element);
              return style.fill === red || style.color === red;
            }),
          rgb('#d64545')
        )
      )
      .toBe(true);

    await page.getByTestId(TID.colorsTextReset).click();
    await expect.poll(() => storedCode(page)).toBe(code);
  });

  test('shows no text controls for a diagram without a style statement', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('sequenceDiagram\n  A->>B: hi'));
    await editPage.checkTextInView('hi');
    await page.getByTestId(TID.colorsCard).click();
    await expect(page.getByText(t('colors.objectsNone'))).toBeVisible();
    await expect(page.getByTestId(TID.colorsText)).toHaveCount(0);
  });
});
