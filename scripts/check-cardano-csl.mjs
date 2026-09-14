import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEPENDENCY_FIELDS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
];
const CSL_PACKAGE_PATTERN = /^@emurgo\/cardano-serialization-lib-(?:browser|nodejs)$/;
const CARDANO_ROOTS = [
    'networks/cardano',
    'packages/connect',
    'packages/connect-web',
    'packages/connect-mobile',
    'packages/connect-webextension',
];

const collectPackageJsonPaths = (root, directory) => {
    const paths = [];
    if (!statSync(directory).isDirectory()) return paths;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'lib') {
                paths.push(...collectPackageJsonPaths(root, entryPath));
            }
        } else if (entry.name === 'package.json') {
            paths.push(relative(root, entryPath));
        }
    }
    return paths;
};

export const findManifestViolations = (manifest, manifestPath) =>
    DEPENDENCY_FIELDS.flatMap(field =>
        Object.keys(manifest[field] ?? {})
            .filter(dependency => CSL_PACKAGE_PATTERN.test(dependency))
            .map(dependency => `${manifestPath}: ${field} contains ${dependency}`),
    );

export const findLockfileViolations = lockfile =>
    lockfile
        .split('\n')
        .filter(line =>
            CSL_PACKAGE_PATTERN.test(
                line
                    .trim()
                    .replace(/^"|":$/g, '')
                    .split('@npm:')[0],
            ),
        )
        .map(line => `yarn.lock: forbidden CSL entry ${line.trim()}`);

export const findCardanoCslViolations = root => {
    const violations = [];
    for (const relativeRoot of CARDANO_ROOTS) {
        const directory = join(root, relativeRoot);
        try {
            for (const manifestPath of collectPackageJsonPaths(root, directory)) {
                const manifest = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
                violations.push(...findManifestViolations(manifest, manifestPath));
            }
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
    }
    violations.push(...findLockfileViolations(readFileSync(join(root, 'yarn.lock'), 'utf8')));
    return violations;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const violations = findCardanoCslViolations(process.cwd());
    if (violations.length > 0) {
        console.error(violations.join('\n'));
        process.exitCode = 1;
    } else {
        console.log('No EMURGO CSL dependencies found in Cardano/Trezor Connect packages');
    }
}
