const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DEFAULT_EXCLUDES = ["node_modules", ".git"];

function shouldExclude(name, excludeList) {
  return excludeList.includes(name);
}

function printTree(dir, prefix, exclude) {
  let items;
  try {
    items = fs.readdirSync(dir);
  } catch {
    return;
  }

  items = items.filter(item => !shouldExclude(item, exclude));

  items.forEach((item, index) => {
    const fullPath = path.join(dir, item);
    const isLast = index === items.length - 1;
    const pointer = isLast ? "└── " : "├── ";

    console.log(prefix + pointer + item);

    try {
      if (fs.statSync(fullPath).isDirectory()) {
        const newPrefix = prefix + (isLast ? "    " : "│   ");
        printTree(fullPath, newPrefix, exclude);
      }
    } catch {}
  });
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
  console.log("Project Tree Generator\n");

  const pathInput = await ask(
    "Enter paths (comma separated) or press ENTER for current directory:\n> "
  );

  const paths = pathInput
    ? pathInput.split(",").map(p => path.resolve(p.trim()))
    : [process.cwd()];

  console.log(
    `\nDefault excluded folders: ${DEFAULT_EXCLUDES.join(", ")}`
  );

  const excludeInput = await ask(
    "Add more excludes (comma separated) or press ENTER to skip:\n> "
  );

  const extraExcludes = excludeInput
    ? excludeInput.split(",").map(e => e.trim())
    : [];

  const excludes = [...new Set([...DEFAULT_EXCLUDES, ...extraExcludes])];

  for (const p of paths) {
    console.log("\n" + p);
    printTree(p, "", excludes);
  }

  console.log("\nDone. Press ENTER to exit...");
  process.stdin.resume();
  process.stdin.once("data", () => process.exit(0));
})();
