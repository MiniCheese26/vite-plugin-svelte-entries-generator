import {Plugin} from 'vite';
import pathFs from 'path';
import fs from 'fs/promises';
import {glob} from 'glob';

interface Path {
    contentPath: string,
    entriesBasePath: string,
    transform?: (filePath: string, entriesBasePath: string) => Promise<string> | string,
}

export interface PluginOptions {
    paths: Path[],
}

const PLUGIN_NAME = 'vite-plugin-svelte-entries-generator';
const SVELTE_CONFIG_FILE = 'svelte.config.js';

const baseTransformPaths = (file: string, entriesBasePath: string) => {
    const extension = pathFs.extname(file);
    const fileName = pathFs.basename(file, extension);
    return `"${entriesBasePath}${fileName}"`;
};

const plugin = ({paths}: PluginOptions): Plugin => {
    return {
        name: PLUGIN_NAME,
        apply: 'build',
        enforce: 'pre',
        config: async (config) => {
            if (!paths) {
                return;
            }

            const root = config.root ?? process.cwd();

            const files = ['"*"', ...(await Promise.all(paths.map(async (path) => {
                const fullPath = pathFs.resolve(root, path.contentPath);

                const transformPaths = path.transform ?? baseTransformPaths;

                let fullPaths: string[];

                try {
                    fullPaths = await glob(fullPath);
                } catch (e) {
                    console.error(`Failed to read ${fullPath}`);
                    return [];
                }

                return await Promise.all(fullPaths.map(async (file) => await transformPaths(file, path.entriesBasePath)));
            }))).flat()];

            const svelteConfigPath = pathFs.resolve(root, SVELTE_CONFIG_FILE);
            let svelteConfig: string;

            try {
                svelteConfig = await fs.readFile(svelteConfigPath, {encoding: 'utf-8'});
            } catch (e) {
                throw new Error(`Failed to read ${svelteConfigPath}`);
            }

            const cleanedSvelteConfig = svelteConfig.replace(/entries:\s\[.+],/gmi, '');
            const modifiedSvelteConfig = cleanedSvelteConfig.replace(/prerender:\s*\{/gmi, `$&entries: [${files.join(',')}],`);

            try {
                await fs.writeFile(svelteConfigPath, modifiedSvelteConfig);
            } catch (e) {
                throw new Error(`Failed to write to ${svelteConfigPath}`);
            }
        },
    };
};

export default plugin;
