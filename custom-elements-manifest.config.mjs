// package.json names dist/custom-elements.json already; without this the analyzer rewrites that to
// wherever it last wrote, such as the docs' temporary folder.
export default { packagejson: false }
