# vite-plugin-svelte-entries-generator

## Doesn't sveltekit auto-discover all pages to pre-render?

Mostly yes, but under certain circumstances, it is unable to discover all dynamic paths to prerender.

For example, you have a dynamic route `posts/[slug]` where you want all the posts to be pre-rendered. But you have some
form of client side pagination which means only a handful of the posts will be caught be sveltekit's `<a>` tag scanning.

Because sveltekit currently lacks something similar to NextJS's `getStaticPaths`, you have to fall back to using
the `prerender.entries` array in the svelte config to tell sveltekit about your dynamic paths.

But this in inflexible and isn't simple to automate. Hence, this plugin. With this plugin, you can pass an array of
base api paths and a transformer function to auto-generate the entries array upon `vite build`.

### There is an open [issue](https://github.com/sveltejs/kit/issues/9506), opened by Rich Harris that'll hopefully render this plugin obsolete

## Usage

Ensure you have `kit.prerender` in `svelte.config.js` somewhere, like so

```js
const config = {
    extensions: ['.svelte'],
    preprocess: [
        preprocess({
            postcss: true,
        })],
    kit: {
        adapter: vercel(),
        prerender: {},
    },
};
```

The `prerender` object can have other data in it, just make sure it exists.

An array of the following object is expected

- `apiPath: string` - The actual route/url this content is found at, I.E. for `/posts/[slug]` you pass `/posts/`
- `transform: (apiPath: string, repoRoot: string) => Promise<string | string[]> | string | string[]` - A function that
  provides the apiPath being processed and the absolute path of the repo, derived from the `package.json` root prop
  or `process.cwd()`. Each entry/string returned should be wrapped in quotation `""` marks. See [below](#transform-examples) for examples.

```js
import entriesGenerator from 'vite-plugin-svelte-entries-generator';
import postTransformer from './transformers/postTransformer'

import {sveltekit} from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
    plugins: [
        sveltekit(),
        entriesGenerator({
            paths: [
                {
                    transform: postTransformer,
                    apiPath: '/posts/'
                }
            ]
        })
    ],
};

export default config;
```

## Transform examples

```ts
import path from 'path';
import glob from 'glob';
import fs from 'fs/promises';
import matter from 'gray-matter';
import type { EntriesTransformFunction } from 'vite-plugin-svelte-entries-generator';

const CONTENT_PATH = 'src/content/posts/*.svx';

const getFilePaths = async (path: string) => {
	try {
		return await glob(path);
	} catch (e) {
		console.error(`Failed to read ${path}`);
		return [];
	}
};

// Reads the filename without the extension of some md/svx files and uses that filename as the slug
export const transformByFilename: EntriesTransformFunction = async (apiPath, repoRoot) => {
	const fullPath = path.resolve(repoRoot, CONTENT_PATH);

	const fullPaths = await getFilePaths(fullPath);

	return fullPaths.map((filePath) => {
		const extension = path.extname(filePath);
		const fileName = path.basename(filePath, extension);
		return `"${apiPath}${fileName}"`;
	});
};

// Reads each md/svx file and parses the frontmatter data to get the posts id and uses that as the slug 
export const transformById: EntriesTransformFunction = async (apiPath, repoRoot) => {
	const fullPath = path.resolve(repoRoot, CONTENT_PATH);

	const fullPaths = await getFilePaths(fullPath);

	return await Promise.all(
		fullPaths.map(async (filePath) => {
			const content = await fs.readFile(filePath, 'utf-8');

			const matterData = matter(content);

			return `"${apiPath}${matterData.data.id}"`;
		})
	);
};

```
