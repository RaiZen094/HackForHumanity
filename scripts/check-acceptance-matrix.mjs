import { readFile } from "node:fs/promises";

const matrix = await readFile(new URL("../docs/acceptance-matrix.md", import.meta.url), "utf8");
const rows = matrix.split(/\r?\n/).filter((line) => /^\| AC\d{2} /.test(line));
const invalid = rows.filter((line) => !/\| (Automated|Implemented|N\/A) \|/.test(line));
if (rows.length !== 78) throw new Error(`Expected 78 acceptance rows, found ${rows.length}.`);
if (invalid.length) throw new Error(`Acceptance rows have invalid statuses:\n${invalid.join("\n")}`);
const counts = rows.reduce((result, row) => {
  const status = row.match(/\| (Automated|Implemented|N\/A) \|/)?.[1] ?? "Invalid";
  result[status] = (result[status] ?? 0) + 1;
  return result;
}, {});
console.log(JSON.stringify({ status: "complete", criteria: rows.length, counts }, null, 2));
