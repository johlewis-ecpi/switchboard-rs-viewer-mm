import path from 'node:path';
import {readManifest, validatePackage} from './manifest.mjs';
import {root} from './build.mjs';
const manifest = await readManifest(root);
const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root,'dist',manifest.id);
const checked = await validatePackage(directory);
console.log(`Valid package: ${checked.manifest.name} (${checked.manifest.id}) · ${checked.bytes} bytes`);
console.log('This checks packaging. Use Preview and Switchboard Test with Sample to check startup and rendering.');
