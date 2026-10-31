import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
    findCardanoCslViolations,
    findLockfileViolations,
    findManifestViolations,
} from './check-cardano-csl.mjs';

const CARDANO_ROOTS = [
    'networks/cardano',
    'packages/connect',
    'packages/connect-web',
    'packages/connect-mobile',
    'packages/connect-webextension',
];

const createWorkspaceRoots = root => {
    for (const directory of CARDANO_ROOTS) {
        mkdirSync(join(root, directory), { recursive: true });
    }
};

test('rejects direct CSL dependencies in package manifests', () => {
    assert.deepEqual(
        findManifestViolations(
            { dependencies: { '@emurgo/cardano-serialization-lib-browser': '14.1.2' } },
            'networks/cardano/example/package.json',
        ),
        [
            'networks/cardano/example/package.json: dependencies contains @emurgo/cardano-serialization-lib-browser',
        ],
    );
});

test('rejects CSL entries in the lockfile', () => {
    assert.deepEqual(
        findLockfileViolations(
            '"@emurgo/cardano-serialization-lib-nodejs@npm:14.1.2":\n  version: 14.1.2\n',
        ),
        ['yarn.lock: forbidden CSL entry "@emurgo/cardano-serialization-lib-nodejs@npm:14.1.2":'],
    );
});

test('rejects patched CSL lockfile descriptors', () => {
    assert.deepEqual(
        findLockfileViolations(
            '"@emurgo/cardano-serialization-lib-browser@patch:@emurgo/cardano-serialization-lib-browser@npm%3A14.1.2#./patches/csl.patch":\n',
        ),
        [
            'yarn.lock: forbidden CSL entry "@emurgo/cardano-serialization-lib-browser@patch:@emurgo/cardano-serialization-lib-browser@npm%3A14.1.2#./patches/csl.patch":',
        ],
    );
});

test('allows unrelated dependencies and historical text', () => {
    assert.deepEqual(
        findManifestViolations(
            { dependencies: { '@dcspark/cardano-multiplatform-lib-nodejs': '6.2.0' } },
            'networks/cardano/example/package.json',
        ),
        [],
    );
    assert.deepEqual(
        findLockfileViolations('# historical cardano-serialization-lib reference'),
        [],
    );
});

test('scans Cardano package trees and the root lockfile', () => {
    const root = mkdtempSync(join(tmpdir(), 'cardano-csl-guard-'));
    try {
        const packageDirectory = join(root, 'networks/cardano/example');
        createWorkspaceRoots(root);
        mkdirSync(packageDirectory, { recursive: true });
        writeFileSync(
            join(packageDirectory, 'package.json'),
            JSON.stringify({
                devDependencies: { '@emurgo/cardano-serialization-lib-nodejs': '14.1.2' },
            }),
        );
        writeFileSync(
            join(root, 'yarn.lock'),
            '"@emurgo/cardano-serialization-lib-browser@npm:14.1.2":\n  version: 14.1.2\n',
        );

        assert.deepEqual(findCardanoCslViolations(root), [
            'networks/cardano/example/package.json: devDependencies contains @emurgo/cardano-serialization-lib-nodejs',
            'yarn.lock: forbidden CSL entry "@emurgo/cardano-serialization-lib-browser@npm:14.1.2":',
        ]);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('fails when a configured package root is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'cardano-csl-missing-root-'));
    try {
        writeFileSync(join(root, 'yarn.lock'), '');

        assert.throws(() => findCardanoCslViolations(root), { code: 'ENOENT' });
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
