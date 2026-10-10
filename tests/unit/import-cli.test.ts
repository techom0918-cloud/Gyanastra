// End-to-end checks of the import CLI and a full plan → commit → re-plan cycle.
// The CLI is only run with --offline, so these tests never touch a database.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { commitImport, isCommitConfirmed, parseInput, prepareImport, PlanOptions } from '@/lib/import/importer';
import { createFakeSupabase, op } from '../support/fake-supabase';

const root = path.resolve(__dirname, '../..');
const fixture = (name: string) => path.join('tests/fixtures/import', name);

function runCli(...args: string[]) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'scripts/import-reports.ts', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

describe('import CLI (offline)', () => {
  it('refuses every tagged CSV fixture in a real run and exits 2 without writing', () => {
    const { code, out } = runCli(fixture('tagged-fixtures.csv'), '--offline');
    expect(code).toBe(2);
    expect(out).toMatch(/rejected \(invalid\):\s+4/);
    expect(out).toMatch(/ready to insert:\s+0/);
    expect(out).toContain('test fixtures are never imported');
    expect(out).toContain('Dry run only');
  }, 60_000);

  it('validates JSON input, refusing personal data and unsupported fields', () => {
    const { code, out } = runCli(fixture('tagged-fixtures.json'), '--offline');
    expect(code).toBe(2);
    expect(out).toContain('studentName: not accepted: personal names are not stored');
    expect(out).toContain('PAN-like identifier');
  }, 60_000);

  it('reports malformed files and invalid option combinations as errors (exit 1)', () => {
    const malformed = runCli(fixture('malformed.csv'), '--offline');
    expect(malformed.code).toBe(1);
    expect(malformed.out).toContain('CSV ends inside a quoted field');

    const contradictory = runCli(fixture('tagged-fixtures.csv'), '--offline', '--commit');
    expect(contradictory.code).toBe(1);
    expect(contradictory.out).toContain('--commit cannot be combined with --offline');
  }, 60_000);
});

describe('commit confirmation', () => {
  it('requires the exact batch id', () => {
    expect(isCommitConfirmed('import-20261010-abc', 'import-20261010-abc')).toBe(true);
    expect(isCommitConfirmed('import-20261010-abc', ' import-20261010-abc \n')).toBe(true);
    for (const answer of [undefined, '', 'y', 'yes', 'import-20261010-ab', 'IMPORT-20261010-ABC']) {
      expect(isCommitConfirmed('import-20261010-abc', answer)).toBe(false);
    }
  });
});

describe('repeat-import idempotency (stateful fake database)', () => {
  it('inserts once, and re-running the same file inserts nothing and changes nothing', async () => {
    const rows: Record<string, unknown>[] = [];
    const { client, queries } = createFakeSupabase((q) => {
      const upsert = op(q, 'upsert');
      if (upsert) {
        const inserted: Record<string, unknown>[] = (upsert.args[0] as Record<string, unknown>[])
          .filter((r) => !rows.some((existing) => existing.import_key === r.import_key))
          .map((r, i) => ({ ...r, id: `db-${rows.length + i}` }));
        rows.push(...inserted);
        return { data: inserted.map((r) => ({ id: r.id, import_key: r.import_key })), error: null };
      }
      if (op(q, 'in')) return { data: rows, error: null };
      return { data: [], error: null }; // schema probe
    });

    const records = parseInput(readFileSync(path.join(root, fixture('tagged-fixtures.csv')), 'utf8'), 'csv');
    const options: PlanOptions = { today: '2026-10-10', batchId: 'import-test', testFixtures: true };

    const first = await prepareImport(client, records, options);
    expect((await commitImport(client, first)).inserted).toHaveLength(2);

    const second = await prepareImport(client, records, options);
    expect(second.toInsert).toEqual([]);
    expect(second.alreadyImported.map((a) => a.row)).toEqual([1, 2]);
    expect((await commitImport(client, second)).inserted).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(queries.some((q) => op(q, 'update') || op(q, 'delete'))).toBe(false);
  });
});
