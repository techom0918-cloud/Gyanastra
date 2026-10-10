// Imports documented offer-outcome records into offer_reports. See docs/data-import.md.
//
//   npm run import:reports -- <file.csv|file.json> [options]
//
// Default is a dry run: validates, checks duplicates against the database, prints the plan, writes nothing.
//   --commit                     insert the planned rows (asks you to type the batch id to confirm)
//   --confirm=<batchId>          non-interactive confirmation for --commit
//   --allow-possible-duplicates  also insert rows flagged as near-duplicates (after manual review)
//   --offline                    validate the file only; no database access, no duplicate check against it
//   --report=<path.json>         write the full plan/rejection report as JSON
//   --format=csv|json            override detection from the file extension
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';
import {
  commitImport,
  computeBatchId,
  ImportError,
  ImportPlan,
  InputFormat,
  isCommitConfirmed,
  parseInput,
  planImport,
  prepareImport,
} from '@/lib/import/importer';
import { CsvParseError } from '@/lib/import/csv';

interface Args {
  file: string;
  format: InputFormat;
  commit: boolean;
  confirm?: string;
  allowPossibleDuplicates: boolean;
  offline: boolean;
  report?: string;
}

function parseArgs(argv: string[]): Args {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = new Map(
    argv.filter((a) => a.startsWith('--')).map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : 'true'] as const;
    })
  );
  const known = new Set(['commit', 'confirm', 'allow-possible-duplicates', 'offline', 'report', 'format']);
  for (const k of flags.keys()) if (!known.has(k)) throw new ImportError(`Unknown option --${k}`);
  if (positional.length !== 1) throw new ImportError('Usage: npm run import:reports -- <file.csv|file.json> [--commit] [--offline] [--report=out.json]');

  const file = positional[0];
  const format = (flags.get('format') ?? path.extname(file).slice(1).toLowerCase()) as InputFormat;
  if (format !== 'csv' && format !== 'json') throw new ImportError('File must be .csv or .json (or pass --format=csv|json)');

  const args: Args = {
    file,
    format,
    commit: flags.has('commit'),
    confirm: flags.get('confirm'),
    allowPossibleDuplicates: flags.has('allow-possible-duplicates'),
    offline: flags.has('offline'),
    report: flags.get('report'),
  };
  if (args.commit && args.offline) throw new ImportError('--commit cannot be combined with --offline');
  return args;
}

function printPlan(plan: ImportPlan, mode: string): void {
  const held = plan.possibleDuplicates.filter((p) => !p.included).length;
  console.log(`\nBatch ${plan.batchId} (${mode})`);
  console.log(`  records in file:        ${plan.totalRecords}`);
  console.log(`  ready to insert:        ${plan.toInsert.length}`);
  console.log(`  rejected (invalid):     ${plan.rejected.length}`);
  console.log(`  already imported:       ${plan.alreadyImported.length}`);
  console.log(`  duplicate within file:  ${plan.duplicateInFile.length}`);
  console.log(`  held as possible dupes: ${held}`);

  for (const r of plan.rejected) {
    console.log(`\n  row ${r.row} REJECTED`);
    for (const e of r.errors) console.log(`    - ${e.field}: ${e.message}`);
  }
  for (const d of plan.duplicateInFile) console.log(`\n  row ${d.row} SKIPPED: same record as row ${d.firstRow}`);
  for (const a of plan.alreadyImported) console.log(`\n  row ${a.row} SKIPPED: already imported as ${a.existingId}`);
  for (const p of plan.possibleDuplicates) {
    const against = p.matches
      .map((m) => (m.fileRow ? `row ${m.fileRow} of this file` : `${m.provenance} report ${m.existingId}`) + ` (${m.reportedAt})`)
      .join(', ');
    console.log(`\n  row ${p.row} ${p.included ? 'INCLUDED despite' : 'HELD for review:'} possible duplicate of ${against}`);
  }
  for (const r of plan.toInsert) {
    console.log(`  + row ${r.row}: ${r.companyName} / ${r.status} / ${r.reportedAt} [${r.evidenceType}, ${r.verificationStatus} → sourceType ${r.sourceType}]`);
  }
}

async function confirmCommit(plan: ImportPlan, confirm?: string): Promise<boolean> {
  if (confirm !== undefined) return isCommitConfirmed(plan.batchId, confirm);
  if (!process.stdin.isTTY) {
    console.error(`\nNot a terminal: pass --confirm=${plan.batchId} to insert non-interactively.`);
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`\nInsert ${plan.toInsert.length} row(s) into the LIVE database? Type the batch id to confirm: `);
    return isCommitConfirmed(plan.batchId, answer);
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const text = readFileSync(args.file, 'utf8');
  const records = parseInput(text, args.format);
  const today = new Date().toISOString().slice(0, 10);
  const batchId = computeBatchId(text, today);
  const options = { today, batchId, allowPossibleDuplicates: args.allowPossibleDuplicates };

  let plan: ImportPlan;
  if (args.offline) {
    plan = planImport(records, [], options);
    printPlan(plan, 'offline validation only — not checked against the database');
  } else {
    try {
      process.loadEnvFile('.env.local');
    } catch {
      // No .env.local: rely on the process environment.
    }
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SECRET_KEY?.trim();
    if (!url || !key) throw new ImportError('SUPABASE_URL and SUPABASE_SECRET_KEY must be set (in .env.local or the environment)');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    plan = await prepareImport(client, records, options);
    printPlan(plan, args.commit ? 'commit requested' : 'dry run — no changes made');

    if (args.commit) {
      if (plan.toInsert.length === 0) {
        console.log('\nNothing to insert.');
      } else if (!(await confirmCommit(plan, args.confirm))) {
        console.error('\nConfirmation did not match the batch id. Nothing was inserted.');
        writeReport(args, plan);
        return 1;
      } else {
        const result = await commitImport(client, plan);
        console.log(`\nInserted ${result.inserted.length} row(s) with import_batch_id = ${plan.batchId}.`);
        if (result.skippedConcurrent.length) {
          console.log(`Skipped rows ${result.skippedConcurrent.join(', ')}: already present when inserting.`);
        }
        writeReport(args, plan, result);
        return 0;
      }
    }
  }

  writeReport(args, plan);
  if (!args.commit) console.log('\nDry run only. Re-run with --commit to insert.');
  return plan.rejected.length > 0 ? 2 : 0;
}

function writeReport(args: Args, plan: ImportPlan, commit?: unknown): void {
  if (!args.report) return;
  writeFileSync(args.report, JSON.stringify({ file: path.basename(args.file), ...plan, commit: commit ?? null }, null, 2));
  console.log(`Report written to ${args.report}`);
}

main().then(
  (code) => process.exit(code),
  (error) => {
    // Only our own messages are printed; they never include credentials.
    if (error instanceof ImportError || error instanceof CsvParseError) console.error(`Error: ${error.message}`);
    else console.error('Unexpected error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
);
