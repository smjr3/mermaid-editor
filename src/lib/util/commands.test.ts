import { TID } from '$/constants';
import { describe, expect, it } from 'vitest';
import { commands, scoreCommand, searchCommands } from './commands';
import { isThemePresetId, themePresets } from './themePresets';

const ids = (query: string) => searchCommands(query).map(({ id }) => id);

describe('command registry', () => {
  it('lists the planned actions with unique ids', () => {
    expect(new Set(commands.map(({ id }) => id)).size).toBe(commands.length);
    const labels = commands.map(({ ja }) => ja);
    for (const wanted of [
      '新しい図を作る',
      '要素を追加',
      '要素を編集',
      '色を変える',
      '向きを変える',
      'アイコンを探す',
      'PNG で保存',
      'SVG で保存',
      '画像をコピー',
      'HTML で保存',
      '共有リンク',
      '使い方',
      '元に戻す',
      'やり直す',
      'テーマ切替',
      '言語切替',
      '履歴',
      'テンプレートを開く',
      'AI用の説明をコピー',
      '不明なアイコンを直す'
    ]) {
      expect(labels).toContain(wanted);
    }
  });

  it('gives every entry ja and en labels, keywords and a target', () => {
    const testIds = new Set<string>(Object.values(TID));
    for (const command of commands) {
      expect(command.ja.trim(), command.id).not.toBe('');
      expect(command.en.trim(), command.id).not.toBe('');
      expect(command.keywords.length, command.id).toBeGreaterThan(0);
      const { target } = command;
      if (target.kind === 'card') {
        for (const id of [target.card, target.focus, target.click]) {
          // A theme card's id is the picker's id plus the preset's.
          const known = id?.startsWith(`${TID.colorsThemePreset}-`)
            ? isThemePresetId(id.slice(TID.colorsThemePreset.length + 1))
            : id && testIds.has(id);
          if (id) expect(known, `${command.id}: ${id}`).toBe(true);
        }
      } else {
        expect(target.action, command.id).toBeTruthy();
      }
    }
  });
});

describe('theme commands', () => {
  it('lists every named theme as 「テーマ: …」 pressing its card in the Colours card', () => {
    for (const { id } of themePresets) {
      const command = commands.find((entry) => entry.id === `theme-${id}`);
      expect(command?.target).toEqual({
        card: TID.colorsCard,
        click: `${TID.colorsThemePreset}-${id}`,
        kind: 'card'
      });
    }
    expect(commands.find(({ id }) => id === 'theme-neon')?.ja).toBe('テーマ: ネオン');
    expect(ids('ネオン')[0]).toBe('theme-neon');
  });
});

describe('searchCommands', () => {
  it('returns everything, in order, for an empty query', () => {
    expect(ids('  ')).toEqual(commands.map(({ id }) => id));
  });

  it('finds an entry by its Japanese label, English label or keyword', () => {
    expect(ids('色')[0]).toBe('colors');
    expect(ids('colour')[0]).toBe('colors');
    expect(ids('png')[0]).toBe('png');
    expect(ids('undo')[0]).toBe('undo');
  });

  it('ranks a label match above a keyword match', () => {
    expect(ids('icon')[0]).toBe('icons');
    expect(ids('履歴')[0]).toBe('history');
  });

  it('ignores case, width and spaces', () => {
    expect(ids('ＰＮＧ')[0]).toBe('png');
    expect(ids('Save As Svg')[0]).toBe('svg');
  });

  it('matches letters in order for longer queries only', () => {
    expect(ids('smpl')).toContain('samples');
    expect(ids('zzz')).toEqual([]);
    expect(scoreCommand('ng', commands[0])).toBe(0);
  });
});
