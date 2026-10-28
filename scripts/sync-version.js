import fs from 'node:fs';

const tag = process.env.GITHUB_REF_NAME || process.argv[2] || '';
const version = tag.replace(/^v/, '').trim();

if (!version) {
  console.log('No version provided, skipping sync.');
  process.exit(0);
}

console.log('Syncing project version to:', version);

// 1. Update package.json
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Updated package.json');

// 2. Update src-tauri/tauri.conf.json
const tauriPath = 'src-tauri/tauri.conf.json';
const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
tauri.version = version;
fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');
console.log('Updated src-tauri/tauri.conf.json');

// 3. Update src-tauri/Cargo.toml
const cargoPath = 'src-tauri/Cargo.toml';
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargo);
console.log('Updated src-tauri/Cargo.toml');
