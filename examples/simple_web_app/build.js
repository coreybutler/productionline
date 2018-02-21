/**
 * It's usually best to run this as an npm script.
 * See the package.json file.
 */
const Builder = ('productionline')
const path = require('path')
const builder = new Builder()

switch (process.argv[2]) {
  case '--make':
    console.log('Running Building Process:')

    // The following are not explicitly necessary since the source,
    // assets, and destination are all being set to their defaults.
    // However; the code is written so you can supply your own
    // folder structure.
    builder.source = path.resolve('./src')
    builder.assets = path.resolve('./assets') // Relative to source!
    builder.destination = path.resolve('./dist')

    // Queue the built-in build process.
    builder.make()
    builder.run()
    break

  default:
    console.log('No command specified!')
}
