import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers'
import { build } from './build';
import { clean } from './clean';

yargs(hideBin(process.argv))
    .command('build', 'Build the project', () => { }, async () => {
        await build();
    }).command('clean', 'Clean the project', () => { }, async () => {
        await clean();
    })
    .showHelpOnFail(false)
    .demandCommand(1)
    .parse();
