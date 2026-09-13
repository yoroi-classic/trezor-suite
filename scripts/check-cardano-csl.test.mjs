import test from 'node:test';
import assert from 'node:assert/strict';

import { findLockfileViolations, findManifestViolations } from './check-cardano-csl.mjs';

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
