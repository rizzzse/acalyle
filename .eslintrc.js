// @ts-check
/* eslint-disable import/unambiguous */

/** @type {import("eslint/lib/shared/types").ConfigData} */
module.exports = {
    extends: ["plugin:oreore-config/standard"],
    parserOptions: {
        project: "tsconfig.json",
    },
    overrides: [
        {
            files: "*.config.*",
            rules: {
                "import/no-default-export": "off",
            },
        },
        {
            files: "main/**",
            parserOptions: {
                project: "main/tsconfig.json",
            },
        },
        {
            files: "preload/**",
            parserOptions: {
                project: "preload/tsconfig.json",
            },
        },
        {
            files: "renderer/**",
            parserOptions: {
                project: "renderer/tsconfig.json",
            },
        },
    ],
    rules: {
        "import/extensions": ["warn", "ignorePackages", {
            ts: "never",
            tsx: "never",
        }],
        "import/no-unresolved": ["warn", {
            ignore: ["^electron/(main|renderer)$"],
        }],
    },
};
