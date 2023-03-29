# vite-plugin-svelte-entries-generator

### Why would I need this? Doesn't sveltekit auto-discover all pages to pre-render?

Mostly yes, but under certain circumstances, it is unable to discover all dynamic paths to prerender.

For example, you have a dynamic route `posts/[slug]` where you want all the posts to be pre-rendered. But you have some
form of client side pagination which means only a handful of the posts will be caught be sveltekit's `<a>` tag scanning.

Because sveltekit currently lacks something similar to NextJS's `getStaticPaths`, you have to fall back to using
the `prerender.entries` array in the svelte config to tell sveltekit about your dynamic paths.

But this in inflexible and isn't simple to automate. Hence, this plugin. With this plugin, you can pass an array of
globs and base urls to auto-generate the entries array upon `vite build`.

### Important Caveat

Right now, this plugin assumes your dynamic routes are importing data from markdown files or something similar. So it's
expecting to be able to determine the dynamic route id from file paths.

### Usage

An array of the following object is expected

- `contentPath: string` - Glob path for discovering content files
- `entriesBasePath: string` - The actual route/url this content is found at, I.E. for `/posts/[slug]` you pass `/posts/`
- `transform?: (filePath: string, entriesBasePath: string) => Promise<string> | string` - A function for determining how
  the files found via the `contentPath` are transformed for entries url. By default, the filename without the extension
  will be assumed the slug/id. You could write a function to read an id from frontmatter data from each file, see example below

```js
import entitiesGenerator from 'vite-plugin-svelte-entries-generator';

import {sveltekit} from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
    plugins: [
        sveltekit(),
        entitiesGenerator({
            paths: [
                {
                    contentPath: 'src/content/posts/*.svx',
                    entriesBasePath: '/posts/'
                }
            ]
        })
    ],
};

export default config;
```

### Default transform function

```ts
const baseTransformPaths = (file: string, entriesBasePath: string) => {
  const extension = pathFs.extname(file);
  const fileName = pathFs.basename(file, extension);
  return `"${entriesBasePath}${fileName}"`;
};
```

### Transform function that reads frontmatter id using [gray-matter](https://github.com/jonschlinkert/gray-matter)

```js
import matter from 'gray-matter';
import fs from 'fs/promises';

const parse = async (file, entriesBasePath) => {
    const content = await fs.readFile(file, 'utf-8');

    const matterData = matter(content);

    return `"${entriesBasePath}${matterData.data.id}"`;
};

export default parse;
```

Then import it and pass it like so

```js
import parse from './parse';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    entitiesGenerator({
      paths: [
        {
          contentPath: 'src/content/posts/*.svx',
          entriesBasePath: '/posts/',
          transform: parse,
        }
      ]
    })
  ],
};

export default config;
```

### This is a personal tool first

Yeah, this is kinda limited, but it's useful for me in my specific scenario.
