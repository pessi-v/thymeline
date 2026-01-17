#!/usr/bin/env npx tsx

/**
 * Validate a timeline JSON file
 *
 * Usage: npx tsx scripts/validate-timeline.ts <path-to-json>
 *
 * Examples:
 *   npx tsx scripts/validate-timeline.ts examples/simple-timeline.json
 *   npx tsx scripts/validate-timeline.ts examples/history-of-socialism.json
 */

import { Temporal } from "@js-temporal/polyfill";
(globalThis as Record<string, unknown>).Temporal = Temporal;

import {
  validateTimelineData,
  formatValidationResult,
} from "../src/utils/validation.ts";
import { readFileSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: npx tsx scripts/validate-timeline.ts <path-to-json>");
  console.error("");
  console.error("Examples:");
  console.error(
    "  npx tsx scripts/validate-timeline.ts examples/simple-timeline.json"
  );
  console.error(
    "  npx tsx scripts/validate-timeline.ts examples/history-of-socialism.json"
  );
  process.exit(1);
}

const filePath = resolve(process.cwd(), args[0]);

try {
  const fileContent = readFileSync(filePath, "utf-8");
  const data = JSON.parse(fileContent);

  const result = validateTimelineData(data);
  console.log(formatValidationResult(result));

  // Exit with error code if validation failed
  if (!result.valid) {
    process.exit(1);
  }
} catch (err: unknown) {
  const error = err as NodeJS.ErrnoException;
  if (error.code === "ENOENT") {
    console.error(`Error: File not found: ${filePath}`);
  } else if (err instanceof SyntaxError) {
    console.error(`Error: Invalid JSON in ${filePath}`);
    console.error(`  ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error(`Error: ${String(err)}`);
  }
  process.exit(1);
}
