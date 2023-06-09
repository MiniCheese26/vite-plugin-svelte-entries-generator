import type {Plugin} from 'vite';
import pathFs from 'path';
import fs from 'fs/promises';

export type EntriesTransformFunction = (apiPath: string, repoRoot: string) => Promise<string | string[]> | string | string[]

export interface Path {
    apiPath: string,
    transform: EntriesTransformFunction,
}

export interface PluginOptions {
    paths: Path[],
    repoRoot?: string,
    svelteConfigPath?: string,
}

const PLUGIN_NAME = 'vite-plugin-svelte-entries-generator';
const SVELTE_CONFIG_FILE = 'svelte.config.js';

const wrap = (text: string) => `"${text}"`;

let hasRun = false;

const plugin = ({paths, repoRoot, svelteConfigPath: userSvelteConfigPath}: PluginOptions): Plugin => {
    return {
        name: PLUGIN_NAME,
        apply: 'build',
        enforce: 'pre',
        config: async (config) => {
            if (hasRun) {
                return;
            }

            hasRun = true;

            if (!paths) {
                return;
            }

            const root = repoRoot ?? config.root ?? process.cwd();

            const svelteConfigPath = userSvelteConfigPath ?? pathFs.resolve(root, SVELTE_CONFIG_FILE);
            let svelteConfig: string;

            try {
                svelteConfig = await fs.readFile(svelteConfigPath, {encoding: 'utf-8'});
            } catch (e) {
                throw new Error(`Failed to read ${svelteConfigPath}`);
            }

            const entries = ['"*"', ...(await Promise.all(paths.map(async (path) => {
                console.info(`[vite-plugin-svelte-entries-generator] - Running transformer for ${path.apiPath}`);
                const transformerResult = await path.transform(path.apiPath, root);

                if (Array.isArray(transformerResult)) {
                    return transformerResult.map(wrap);
                } else if (transformerResult.length > 0) {
                    return wrap(transformerResult);
                }

                return [];
            }))).flat()];

            const cleanedSvelteConfig = svelteConfig.replace(/entries:\s*\[[\W\w]+?],?/gmi, '');
            const modifiedSvelteConfig = cleanedSvelteConfig.replace(/prerender:\s*\{/gmi, `$&entries: [${entries.join(',')}],`);

            try {
                await fs.writeFile(svelteConfigPath, modifiedSvelteConfig);
            } catch (e) {
                throw new Error(`Failed to write to ${svelteConfigPath}`);
            }
        },
    };
};

export default plugin;
