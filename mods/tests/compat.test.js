import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'acorn';

// Tizen 3 ships Chrome 47 (ES2015). Anything newer in the shipped bundles breaks old TVs at parse time.
for (const name of ['userScript.js', 'service.js']) {
    const file = new URL(`../../dist/${name}`, import.meta.url);
    test(`dist/${name} only uses ES2015 syntax`, { skip: !existsSync(file) }, () => {
        assert.doesNotThrow(() => parse(readFileSync(file, 'utf8'), { ecmaVersion: 2015 }));
    });
}
