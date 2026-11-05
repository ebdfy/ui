// package.json names dist/custom-elements-v2.json already; without this the analyzer rewrites that to
// wherever it last wrote, such as the manifest's temporary folder.
export default { packagejson: false }
