import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src", "cli", "ui-template.hbs");
const targetDir = path.join(root, "dist", "cli");
const target = path.join(targetDir, "ui-template.hbs");

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
