import { $ } from 'zx';
import path from 'path';

export async function build() {
    const packageJsonFile = Bun.file('package.json');
    const packageJson = JSON.parse(await packageJsonFile.text());

    const kokaBun = packageJson['koka-bun'];

    if (!kokaBun) {
        throw new Error('koka-bun not found in package.json');
    }

    let root = kokaBun.root ?? '.';
    let main = kokaBun.main;

    if (!main) {
        throw new Error('koka-bun.main not specified in package.json');
    }

    const allPackageJsonFiles = (await $`find . -name package.json`.text())
        .split('\n')
        .filter(Boolean);
    const allPackageJsons: Record<string, string> = Object.fromEntries(
        await Promise.all(allPackageJsonFiles.map(file => Bun.file(file).text().then(content => [file, content])))
    );

    const include: string[] = kokaBun.include ?? [];
    const kokaBunProjects: string[] = [];
    for (const [file, content] of Object.entries(allPackageJsons)) {
        const parentDir = path.dirname(file);
        const json = JSON.parse(content);
        if (!!json['koka-bun']) {
            include.push(path.join(parentDir, json['koka-bun'].root) ?? parentDir);
            kokaBunProjects.push(parentDir);
        }
    }

    const vscodeSettingsFile = Bun.file('.vscode/settings.json');
    const vscodeSettings = JSON.parse(await vscodeSettingsFile.text());
    vscodeSettings['koka.languageServer.compilerArguments'] = [
        ...include.map(path => `--include=${path}`),
    ];
    await Bun.write(vscodeSettingsFile, JSON.stringify(vscodeSettings, null, 4));

    const kokaArgs = [
        '--target=jsnode',
        '--output=.koka/js/kb-main',
        '--outputdir=.koka/js',
        `--include=${root}`,
        ...include.map(path => `--include=${path}`),
        main
    ];

    await $`koka ${kokaArgs}`;

    const typescriptFiles =
        (await Promise.all(kokaBunProjects.map((project) =>
            $`find ${project} -name '*.ts'`.text()
                .then(output => output
                    .split('\n')
                    .filter((path) => !!path && !path.startsWith('./node_modules') && !path.startsWith('./dist'))
                    .map(file => path.join(project, file))
        )))).flat();

    const external = typescriptFiles.map(file => path.resolve(path.join('.koka', 'js', file)));

    const output = await Bun.build({
        entrypoints: ['.koka/js/kb-main.mjs'],
        external,
        naming: 'main.js',
        outdir: 'dist',
    });

    if (!output.success) {
        console.error(output.logs);
        process.exit(1);
    }

    await $`mkdir -p dist`;

    for (const file of typescriptFiles) {
        await $`mkdir -p dist/${path.dirname(file)}`;
        await $`cp ${file} dist/${file}`;
    }
}
