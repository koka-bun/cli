import { $ } from 'zx';
import path from 'path';

export async function build() {
    $.verbose = true;

    const packageJsonFile = Bun.file('package.json');
    const packageJson = JSON.parse(await packageJsonFile.text());

    const kokaDependencies = Object
        .entries(packageJson.devDependencies)
        .filter(([name]) => name.startsWith('koka-pkg/'));

    const includePaths = kokaDependencies.map(([name]) => `node_modules/${name}`);

    const vscodeSettingsFile = Bun.file('.vscode/settings.json');
    const vscodeSettings = JSON.parse(await vscodeSettingsFile.text());
    vscodeSettings['koka.languageServer.compilerArguments'] = [
        ...includePaths.map(path => `--include=${path}`),
    ];
    await Bun.write(vscodeSettingsFile, JSON.stringify(vscodeSettings, null, 4));

    const kokaArgs = [
        '--target=js',
        '--outputdir=.koka/js',
        '--include=src',
        ...includePaths.map(path => `--include=${path}`),
        'src/main.kk'
    ];

    await $`koka ${kokaArgs}`;

    const typescriptFiles =
        (await $`find src -name '*.ts'`.text())
            .split('\n')
            .map(s => s.replace(/^src\//, ''))
            .filter(Boolean);

    console.log(typescriptFiles);

    await Bun.build({
        entrypoints: ['.koka/js/main__main.mjs'],
        external: typescriptFiles.map(file => path.resolve(`.koka/js/${file}`)),
        outdir: '.koka/js',
    });

    await $`mkdir -p dist`;
    await $`cp -r .koka/js/main__main.js dist/main.js`;

    for (const file of typescriptFiles) {
        await $`mkdir -p dist/${path.dirname(file)}`;
        await $`cp src/${file} dist/${file}`;
    }
}
