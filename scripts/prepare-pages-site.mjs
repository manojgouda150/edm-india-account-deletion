import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

class PagesOutputError extends Error {}

function assertBasePath(basePath) {
  if (
    typeof basePath !== "string"
    || !basePath.startsWith("/")
    || !basePath.endsWith("/")
    || basePath.includes("//")
    || basePath.includes("?")
    || basePath.includes("#")
  ) {
    throw new PagesOutputError("Pages base path must be an absolute path ending in '/'.");
  }
}

async function verifyHtmlAndAssets(outputDirectory, basePath) {
  const root = path.resolve(outputDirectory);
  const indexPath = path.join(root, "index.html");
  const fallbackPath = path.join(root, "404.html");
  const routePath = path.join(root, "delete-account", "index.html");
  let indexHtml;
  try {
    indexHtml = await readFile(indexPath, "utf8");
  } catch {
    throw new PagesOutputError("Unable to read Pages HTML output.");
  }

  for (const requiredPath of [fallbackPath, routePath]) {
    let html;
    try {
      html = await readFile(requiredPath, "utf8");
    } catch {
      throw new PagesOutputError("Unable to read Pages HTML output.");
    }
    if (html !== indexHtml) {
      throw new PagesOutputError("Pages route shell does not match index.html.");
    }
  }

  const references = [...indexHtml.matchAll(/\b(src|href)=["']([^"']+)["']/gi)]
    .map((match) => ({
      attribute: match[1].toLowerCase(),
      reference: match[2],
    }))
    .filter(({ reference }) => !/^(?:[a-z][a-z\d+.-]*:|#)/i.test(reference));
  const localReferences = references.map(({ attribute, reference }) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(reference, "https://pages.invalid").pathname,
      );
    } catch {
      throw new PagesOutputError(
        `Invalid local asset reference (attribute: ${attribute}).`,
      );
    }
    return { attribute, pathname };
  });
  const assetReferences = localReferences.filter(({ pathname }) =>
    pathname.includes("/assets/"));

  if (assetReferences.length === 0) {
    throw new PagesOutputError(
      "Built HTML does not reference assets under the project base path.",
    );
  }

  for (const { attribute, pathname } of localReferences) {
    if (!pathname.startsWith(basePath)) {
      throw new PagesOutputError(
        `Invalid local asset reference (attribute: ${attribute}).`,
      );
    }

    const relativeAssetPath = pathname.slice(basePath.length);
    const resolvedAssetPath = path.resolve(root, relativeAssetPath);
    const pathFromRoot = path.relative(root, resolvedAssetPath);
    if (pathFromRoot.startsWith("..") || path.isAbsolute(pathFromRoot)) {
      throw new PagesOutputError(
        `Invalid local asset reference (attribute: ${attribute}).`,
      );
    }

    try {
      if (!(await stat(resolvedAssetPath)).isFile()) {
        throw new PagesOutputError(
          `Missing local asset (attribute: ${attribute}).`,
        );
      }
    } catch (error) {
      if (error instanceof PagesOutputError) throw error;
      throw new PagesOutputError(
        `Missing local asset (attribute: ${attribute}).`,
      );
    }
  }
}

export async function verifyPagesOutput(outputDirectory, basePath) {
  assertBasePath(basePath);
  const requiredFiles = ["index.html", "404.html", "delete-account/index.html"];
  for (const relativePath of requiredFiles) {
    const requiredPath = path.join(outputDirectory, ...relativePath.split("/"));
    try {
      if (!(await stat(requiredPath)).isFile()) {
        throw new PagesOutputError("Required Pages output file is missing.");
      }
    } catch (error) {
      if (error instanceof PagesOutputError) throw error;
      throw new PagesOutputError("Required Pages output file is missing.");
    }
  }
  await verifyHtmlAndAssets(outputDirectory, basePath);
}

export async function preparePagesOutput(outputDirectory, basePath) {
  assertBasePath(basePath);
  const indexPath = path.join(outputDirectory, "index.html");
  const routeDirectory = path.join(outputDirectory, "delete-account");
  try {
    await mkdir(routeDirectory, { recursive: true });
    await copyFile(indexPath, path.join(outputDirectory, "404.html"));
    await copyFile(indexPath, path.join(routeDirectory, "index.html"));
  } catch {
    throw new PagesOutputError("Unable to prepare Pages route files.");
  }
  await verifyPagesOutput(outputDirectory, basePath);
}

async function runCli() {
  const [mode, outputDirectoryArg, basePathArg] = process.argv.slice(2);
  if (!["--prepare", "--check"].includes(mode) || !outputDirectoryArg || !basePathArg) {
    throw new Error(
      "Usage: node prepare-pages-site.mjs (--prepare|--check) <output-directory> <base-path>",
    );
  }

  const outputDirectory = path.resolve(process.cwd(), outputDirectoryArg);
  if (mode === "--prepare") {
    await preparePagesOutput(outputDirectory, basePathArg);
  } else {
    await verifyPagesOutput(outputDirectory, basePathArg);
  }
  console.log("Verified GitHub Pages route and local assets.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    console.error(error instanceof PagesOutputError
      ? error.message
      : "Unable to prepare or validate Pages output.");
    process.exitCode = 1;
  });
}
