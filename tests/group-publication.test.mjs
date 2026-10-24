import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGroupIssues } from '../src/lib/group';

const fixture = vi.hoisted(() => ({ root: undefined }));

// Redirect only the public group directory to real temporary files. Parsing,
// filename selection, validation and Markdown rendering use the production loader.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const redirect = (file) => {
    if (fixture.root === undefined) return file;
    const groupRoot = path.join(process.cwd(), 'editorial', 'group');
    const name = String(file);
    if (name === groupRoot) return fixture.root;
    if (name.startsWith(`${groupRoot}${path.sep}`)) {
      return path.join(fixture.root, path.relative(groupRoot, name));
    }
    return file;
  };
  return {
    ...actual,
    existsSync: (file) => actual.existsSync(redirect(file)),
    readdirSync: (file, ...args) => actual.readdirSync(redirect(file), ...args),
    readFileSync: (file, ...args) => actual.readFileSync(redirect(file), ...args),
  };
});

beforeEach(() => { fixture.root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-group-contract-')); });
afterEach(() => {
  rmSync(fixture.root, { recursive: true, force: true });
  fixture.root = undefined;
});

function writeIssue(filename, { issue = 1, published = "'2026-10-01'" } = {}) {
  writeFileSync(path.join(fixture.root, filename), [
    '---',
    `issue: ${issue}`,
    'title: Synthetic group record',
    'kind: Discussion',
    ...(published === null ? [] : [`published: ${published}`]),
    'summary: A fictional discussion about an event on 1980-03-04.',
    '---',
    '## Fictional historical event',
    '',
    'This fictional event took place on 1980-03-04.',
  ].join('\n'));
}

describe('group publication input contracts', () => {
  it('loads matching filenames into stable routes and orders by numeric issue', async () => {
    for (const issue of [0, 2, 10]) writeIssue(`${issue}.md`, { issue });
    const issues = await getGroupIssues();
    expect(issues.map(({ issue, id, route }) => ({ issue, id, route }))).toEqual([
      { issue: 10, id: '10', route: '/group/10/' },
      { issue: 2, id: '2', route: '/group/2/' },
      { issue: 0, id: '0', route: '/group/0/' },
    ]);
    expect(issues.every(({ html }) => html.includes('Fictional historical event'))).toBe(true);
  });

  it.each(['2.md', 'issue-one.md'])('rejects %s when its identity disagrees with the issue', async (filename) => {
    writeIssue(filename);
    await expect(getGroupIssues()).rejects.toThrow(/filename.*issue number/i);
  });

  it('rejects two filenames resolving to the same issue number', async () => {
    writeIssue('1.md');
    writeIssue('01.md');
    await expect(getGroupIssues()).rejects.toThrow(/issue number.*unique/i);
  });

  it('ignores names and directory entries outside the Markdown record selection', async () => {
    writeIssue('1.md');
    for (const name of ['bad name.md', 'UPPER.md', 'bad_name.md', '2.txt']) {
      writeFileSync(path.join(fixture.root, name), '---\ninvalid: [');
    }
    mkdirSync(path.join(fixture.root, '3.md'));
    expect((await getGroupIssues()).map(({ id }) => id)).toEqual(['1']);
  });

  it.each(["'2026-10-01'", '2026-10-01'])('uses the explicit website date from YAML %s, independently of historical text', async (published) => {
    writeIssue('1.md', { published });
    const [issue] = await getGroupIssues();
    expect(issue.published).toBe('2026-10-01');
    expect(issue.summary).toContain('1980-03-04');
    expect(issue.html).toContain('1980-03-04');
  });

  it.each([null, "'1980'", "'2026-02-31'"])('rejects missing or invalid publication date %j without deriving it from the body', async (published) => {
    writeIssue('1.md', { published });
    await expect(getGroupIssues()).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ path: ['published'] })]),
    });
  });
});
