#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { program } = require("commander");
const pkg = require("./package.json");

const DEFAULT_EXCLUDES = ["node_modules", ".git"];

function getDefaultConfigPath() {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "project-tree", "config.json");
  }

  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "project-tree", "config.json");
  }

  return path.join(os.homedir(), ".config", "project-tree", "config.json");
}

const DEFAULT_CONFIG_PATH = getDefaultConfigPath();

function parseList(str) {
  if (!str) {
    return [];
  }

  return str
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function uniqueStrings(items) {
  return [...new Set(items)];
}

function normalizeSavedExcludes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(
    value
      .filter(item => typeof item === "string")
      .map(item => item.trim())
      .filter(Boolean)
  );
}

function parseTargets(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const splitValues = values.flatMap(value => parseList(value));
  return uniqueStrings(splitValues.map(item => path.resolve(item)));
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { savedExcludes: [] };
  }

  let raw;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read config file at ${configPath}: ${error.message}`);
  }

  if (!raw.trim()) {
    return { savedExcludes: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in config file ${configPath}: ${error.message}`);
  }

  return {
    savedExcludes: normalizeSavedExcludes(parsed.savedExcludes || parsed.excludes)
  };
}

function writeConfig(configPath, config) {
  const normalized = {
    savedExcludes: normalizeSavedExcludes(config.savedExcludes)
  };

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

function printSavedExcludes(configPath, excludes) {
  console.log(`\nSaved excludes (${configPath}):`);
  if (excludes.length === 0) {
    console.log("(none)");
    return;
  }

  for (const item of excludes) {
    console.log(`- ${item}`);
  }
}

function walkTree(dir, prefix, excludeSet) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`${prefix}[unreadable] ${path.basename(dir)} (${error.message})`);
    return;
  }

  entries = entries
    .filter(entry => !excludeSet.has(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  entries.forEach((entry, index) => {
    const fullPath = path.join(dir, entry.name);
    const isLast = index === entries.length - 1;
    const pointer = isLast ? "└── " : "├── ";

    console.log(prefix + pointer + entry.name);

    if (entry.isDirectory()) {
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      walkTree(fullPath, newPrefix, excludeSet);
    }
  });
}

function printTarget(targetPath, excludeSet) {
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    console.error(`\n[skip] Path not found: ${resolved}`);
    return false;
  }

  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    console.error(`\n[skip] Cannot read path: ${resolved} (${error.message})`);
    return false;
  }

  console.log(`\n${resolved}`);

  if (stat.isFile()) {
    return true;
  }

  walkTree(resolved, "", excludeSet);
  return true;
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

(async () => {
  program
    .name(pkg.name || "project-tree")
    .description(pkg.description || "Print the structure of a project")
    .version(pkg.version || "0.0.0")
    .argument("[targets...]", "Space-separated target paths")
    .option("-p, --paths <paths>", "Comma-separated paths to print")
    .option("-e, --exclude <items>", "Comma-separated folders/files to exclude")
    .option("--config <path>", `Config file path (default: ${DEFAULT_CONFIG_PATH})`)
    .option("--set-saved-excludes <items>", "Replace saved excludes in config with comma-separated values")
    .option("--add-saved-excludes <items>", "Add comma-separated excludes to config")
    .option("--remove-saved-excludes <items>", "Remove comma-separated excludes from config")
    .option("--clear-saved-excludes", "Clear all saved excludes in config")
    .option("--list-saved-excludes", "Print saved excludes from config and exit when no target is provided")
    .option("--no-default-ignores", "Disable default ignores (node_modules, .git) for this run")
    .option("-y, --yes", "Run non-interactive with defaults")
    .option("-n, --non-interactive", "Run without prompts (uses provided options or defaults)")
    .showHelpAfterError()
    .parse(process.argv);

  const opts = program.opts();
  const positionalTargets = parseTargets(program.args || []);
  const pathTargets = opts.paths ? parseTargets([opts.paths]) : [];
  const explicitTargets = uniqueStrings([...positionalTargets, ...pathTargets]);
  const configPath = opts.config ? path.resolve(opts.config) : DEFAULT_CONFIG_PATH;

  let config;
  try {
    config = readConfig(configPath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const setProvided = typeof opts.setSavedExcludes === "string";
  const addProvided = typeof opts.addSavedExcludes === "string";
  const removeProvided = typeof opts.removeSavedExcludes === "string";
  const clearProvided = Boolean(opts.clearSavedExcludes);
  const hasConfigMutation = setProvided || addProvided || removeProvided || clearProvided;

  if (setProvided) {
    config.savedExcludes = parseList(opts.setSavedExcludes);
  }

  if (addProvided) {
    config.savedExcludes = uniqueStrings([...config.savedExcludes, ...parseList(opts.addSavedExcludes)]);
  }

  if (removeProvided) {
    const toRemove = new Set(parseList(opts.removeSavedExcludes));
    config.savedExcludes = config.savedExcludes.filter(item => !toRemove.has(item));
  }

  if (clearProvided) {
    config.savedExcludes = [];
  }

  if (hasConfigMutation) {
    writeConfig(configPath, config);
    console.log(`\n[config] Saved excludes updated at ${configPath}`);
  }

  if (opts.listSavedExcludes || hasConfigMutation) {
    printSavedExcludes(configPath, config.savedExcludes);
  }

  if (explicitTargets.length === 0 && (opts.listSavedExcludes || hasConfigMutation)) {
    process.exit(0);
  }

  const shouldPrompt = !opts.nonInteractive && !opts.yes && explicitTargets.length === 0;

  let targets = explicitTargets;
  let useDefaultIgnores = opts.defaultIgnores;
  let runtimeExcludes = opts.exclude ? parseList(opts.exclude) : [];

  if (shouldPrompt) {
    console.log("Project Tree Generator\n");
    const pathInput = await ask("Enter paths (comma separated) or press ENTER for current directory:\n> ");
    targets = pathInput ? parseTargets([pathInput]) : [process.cwd()];

    if (config.savedExcludes.length > 0) {
      console.log(`\nSaved excludes from config: ${config.savedExcludes.join(", ")}`);
    } else {
      console.log("\nSaved excludes from config: (none)");
    }

    if (useDefaultIgnores) {
      console.log(`Default excludes: ${DEFAULT_EXCLUDES.join(", ")}`);
    }

    const disableDefaultsInput = await ask("Disable default excludes for this run? (y/N):\n> ");
    if (/^(y|yes)$/i.test(disableDefaultsInput)) {
      useDefaultIgnores = false;
    }

    const excludeInput = await ask("Add one-time excludes (comma separated) or press ENTER to skip:\n> ");
    runtimeExcludes = excludeInput ? parseList(excludeInput) : [];
  }

  if (targets.length === 0) {
    targets = [process.cwd()];
  }

  const combinedExcludes = uniqueStrings([
    ...(useDefaultIgnores ? DEFAULT_EXCLUDES : []),
    ...config.savedExcludes,
    ...runtimeExcludes
  ]);
  const excludeSet = new Set(combinedExcludes);

  let printedCount = 0;
  for (const target of targets) {
    if (printTarget(target, excludeSet)) {
      printedCount += 1;
    }
  }

  if (printedCount === 0) {
    process.exit(1);
  }
})();
