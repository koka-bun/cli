import { $ } from 'zx';

export async function clean() {
    $.verbose = true;

    await $`rm -rf dist .koka`;
}
