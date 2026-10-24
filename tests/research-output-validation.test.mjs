import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResearchRecordsSchema } from '../src/lib/research-record.mjs';
import { researcherFixture, publicationPath, researcherId } from './helpers/researcher-publication-fixture.mjs';

const fixtures = [];
afterEach(() => {
  vi.restoreAllMocks();
  fixtures.splice(0).forEach(input => input.cleanup());
});
function fixture() {
  const input = researcherFixture(); fixtures.push(input);
  input.writeBytes('people/fixture/portrait.jpg', Buffer.from('SYNTHETIC_PORTRAIT'));
  input.mutate(publicationPath, manifest => {
    manifest.records.find(entry => entry.public_id === researcherId).portrait_path = 'people/fixture/portrait.jpg';
  });
  return input;
}

function snapshot(root) {
  if (!existsSync(root)) return null;
  const entries = [];
  const visit = (file) => {
    const stat = statSync(file, { bigint: true });
    entries.push({ path: path.relative(root, file), mode: String(stat.mode), mtime: String(stat.mtimeNs),
      content: stat.isFile() ? readFileSync(file).toString('base64') : null });
    if (stat.isDirectory()) readdirSync(file).sort().forEach(name => visit(path.join(file, name)));
  };
  visit(root);
  return entries;
}

describe('research output validation before writing', () => {
  it('validates the entire planned public payload while retaining its serialization order and portrait plan', () => {
    const input = fixture();
    const parse = vi.spyOn(ResearchRecordsSchema, 'parse');
    const result = input.outputs();
    expect(parse).toHaveBeenCalledTimes(1);
    const planned = parse.mock.calls[0][0];
    expect(JSON.stringify(result.records)).toBe(JSON.stringify(planned));
    expect(parse.mock.results[0].value).toEqual(result.records);
    expect(planned).not.toHaveProperty('portraits');
    expect(result.portraits.get(`${researcherId}.jpg`)).toBe(path.join(input.sourceRoot, 'people/fixture/portrait.jpg'));
  });

  it('preserves CLI success and check-difference exit codes and writes the exact planned bytes', () => {
    const input = fixture();
    const outputRoot = path.join(input.publicRoot, '.website-input');
    expect(input.run(true).status).toBe(1);
    expect(snapshot(outputRoot)).toBeNull();
    const expected = `${JSON.stringify(input.plan(), null, 2)}\n`;
    const written = input.run();
    expect(written.status, written.stderr).toBe(0);
    expect(readFileSync(path.join(outputRoot, 'research-records.json'), 'utf8')).toBe(expected);
    expect(readFileSync(input.generatedPortrait(`${researcherId}.jpg`))).toEqual(Buffer.from('SYNTHETIC_PORTRAIT'));
    const before = snapshot(outputRoot);
    expect(input.run(true).status).toBe(0);
    expect(snapshot(outputRoot)).toEqual(before);
    input.mutate(publicationPath, manifest => {
      manifest.records.find(entry => entry.public_id === researcherId).summary_zh = 'Changed synthetic summary.';
    });
    expect(input.run(true).status).toBe(1);
    expect(snapshot(outputRoot)).toEqual(before);
  });

  for (const checkOnly of [false, true]) {
    it.each([false, true])(`rejects invalid final output before creation, overwrite, photo copy or withdrawal cleanup (check=${checkOnly}, existing=%s)`, (existing) => {
      const input = fixture();
      const outputRoot = path.join(input.publicRoot, '.website-input');
      if (existing) {
        mkdirSync(path.join(outputRoot, 'portraits'), { recursive: true });
        writeFileSync(path.join(outputRoot, 'research-records.json'), 'ORIGINAL_GENERATED_INPUT');
        writeFileSync(path.join(outputRoot, 'portraits', `${researcherId}.jpg`), 'ORIGINAL_PORTRAIT');
        writeFileSync(path.join(outputRoot, 'portraits', 'withdrawn.jpg'), 'WITHDRAWN_PORTRAIT');
      }
      const before = snapshot(outputRoot);
      // Fault injection at the final validation boundary. Keep the actual Zod
      // parser and sync CLI; submit a malformed public object to that parser.
      const moduleUrl = pathToFileURL(path.join(input.publicRoot, 'src/lib/research-record.mjs')).href;
      const preload = `
        const {ResearchRecordsSchema} = await import(${JSON.stringify(moduleUrl)});
        const parse = ResearchRecordsSchema.parse.bind(ResearchRecordsSchema);
        ResearchRecordsSchema.parse = records => parse({ ...records,
          researchers: records.researchers.map(record => ({ ...record, private_path: 'private/synthetic.json' })) });
      `;
      const result = input.run(checkOnly, ['--import', `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`]);
      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/Research record sync error:/);
      expect(result.stderr).toContain('unrecognized_keys');
      expect(result.stderr).toContain('researchers');
      expect(snapshot(outputRoot)).toEqual(before);
    });
  }
});
