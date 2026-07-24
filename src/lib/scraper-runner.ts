import { spawn } from "child_process";

const SCRAPER_SCRIPTS: Record<string, string> = {
  oosterberg: "scrape-oosterberg.mjs",
  rexel: "scrape-rexel.mjs",
  estg: "scrape-estg.mjs",
  "4blue": "scrape-4blue.mjs",
  elektramat: "scrape-elektramat.mjs",
  technim: "scrape-technim.mjs",
};

export function buildScraperCommand(supplier: string, query: string, companySlug: string) {
  const scriptName = SCRAPER_SCRIPTS[supplier] ?? SCRAPER_SCRIPTS.oosterberg;
  const scriptsDir = [process.cwd(), "scripts"].join("/");
  const scriptPath = [scriptsDir, scriptName].join("/");
  const args = [scriptPath, query, "--save", "--company", companySlug];
  return { args };
}

export function spawnScraper(supplier: string, query: string, companySlug: string) {
  const { args } = buildScraperCommand(supplier, query, companySlug);
  return { child: spawn("node", args, { cwd: process.cwd() }), args };
}
