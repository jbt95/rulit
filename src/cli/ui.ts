#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Handlebars from "handlebars";
import { registry } from "../registry.js";

type CliOptions = {
  port: number;
  load: string[];
};

export async function startServer(options: CliOptions) {
  await loadModules(options.load, Date.now());

  const server = http.createServer((req, res) => {
    if (!req.url || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(buildHtml());
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(options.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Rulit UI running at http://localhost:${options.port}`);
  });
}

export function buildHtml() {
  const entries = registry.list();
  const template = Handlebars.compile(loadTemplate());
  const view = {
    entries: entries.map((entry) => {
      const mermaid = registry.getMermaid(entry.id) ?? "flowchart TD\n  empty";
      const graph = registry.getGraph(entry.id) ?? { nodes: [], edges: [] };
      return {
        id: entry.id,
        name: entry.name ?? entry.id,
        createdAt: new Date(entry.createdAt).toLocaleString(),
        mermaid,
        mermaidEncoded: encodeURIComponent(mermaid),
        traces: registry.listTraces(entry.id).map((trace) => ({
          id: trace.id,
          createdAt: new Date(trace.createdAt).toLocaleString(),
          firedCount: trace.fired.length,
          matchedCount: trace.trace.filter((rule) => rule.matched).length,
          traceEncoded: encodeURIComponent(JSON.stringify(trace)),
        })),
        json: JSON.stringify(graph, null, 2),
      };
    }),
  };

  return template(view);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    port: 5173,
    load: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (!value) {
      continue;
    }
    if (value === "--port") {
      const next = args[i + 1];
      if (next) {
        options.port = Number(next);
        i += 1;
      }
      continue;
    }
    if (value === "--load") {
      const next = args[i + 1];
      if (next) {
        options.load.push(next);
        i += 1;
      }
      continue;
    }
  }

  const envLoad = process.env.RULIT_UI_LOAD;
  if (envLoad) {
    options.load.push(
      ...envLoad
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  const envPort = process.env.RULIT_UI_PORT;
  if (envPort) {
    options.port = Number(envPort);
  }

  return options;
}

async function loadModules(paths: string[], cacheBust: number) {
  for (const modulePath of paths) {
    const fullPath = path.resolve(process.cwd(), modulePath);
    await import(`${pathToFileURL(fullPath).href}?t=${cacheBust}`);
  }
}

const isMain =
  typeof import.meta.url === "string" &&
  import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  void startServer(options);
}

function loadTemplate() {
  const templatePath = resolveTemplatePath();
  if (!templatePath) {
    throw new Error("UI template not found. Expected ui-template.hbs near cli ui.");
  }
  return fs.readFileSync(templatePath, "utf8");
}

function resolveTemplatePath(): string | null {
  const candidates: (string | URL)[] = [];

  if (typeof import.meta.url === "string") {
    candidates.push(
      new URL("./ui-template.hbs", import.meta.url),
      new URL("../../src/cli/ui-template.hbs", import.meta.url),
    );
  } else {
    // Fallback for CJS if necessary, though we prefer ESM for CLI
    candidates.push(path.join(__dirname, "ui-template.hbs"));
  }

  for (const candidate of candidates) {
    const filePath = typeof candidate === "string" ? candidate : fileURLToPath(candidate);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}
