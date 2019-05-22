const yargs = require("yargs").argv;
const resolve = require("path").resolve;
const join = require("path").join;
const fs = require("fs");
const prettyjson = require("prettyjson");

function getAllPackageFolderNames() {

    const root = resolve("./packages");
    return fs.readdirSync(root).filter(dirName => {
        const stat = fs.statSync(join(root, dirName));
        return stat && stat.isDirectory();
    });
}

let mode = "cmd";
let paths = ["./test/main.ts"];

// handle package specific config
if (yargs.packages || yargs.p) {

    const packageNames = (yargs.packages || yargs.p).split(",").map(s => s.trim().toLowerCase());

    const processingPackages = [];

    for (let i = 0; i < packageNames.length; i++) {

        // see of we have any package entries and pass them along as-is
        const found = getAllPackageFolderNames().filter(p => {
            return ((typeof p === "string" && p === packageNames[i]) || (p.name === packageNames[i]));
        });

        processingPackages.push(...found);
    }

    if (yargs.single || yargs.s) {
        // and only a single set of tests
        paths.push(resolve(`./test/${processingPackages[0]}/`, (yargs.single || yargs.s) + ".ts"));
    } else {
        paths.push(...processingPackages.map(p => `./test/${p}/**/*.ts`));
    }
} else {
    paths.push("./test/**/*.ts");
}

// handle mode config
if (yargs.mode && /cmd|pr|push/i.test(yargs.mode)) {

    switch (yargs.mode) {

        case "pr":
            mode = "travis-noweb"
            break;

        case "push":
            mode = "travis";
            break;

        default:
            mode = "cmd";
    }
}

const reporter = yargs.verbose ? "spec" : "dot";

const config = {
    "package": "./package.json",
    "reporter": reporter,
    "slow": 3000,
    "timeout": 40000,
    "ui": "bdd",
    "require": [
        "tsconfig-paths/register",
        "ts-node/register"
    ],
    "spec": paths,
    "pnp-test-mode": mode,
    "pnp-test-site": yargs.site || yargs.pnpTestSite || "''",
    "skip-web": yargs.skipWeb,
};

console.info("pnp generated mocha config:");
console.info(prettyjson.render(config, null, 4, { noColor: true }));

module.exports = config;
