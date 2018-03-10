/**
 * It's usually best to run this as an npm script.
 * See the package.json file.
 */
const Builder = ('productionline-web')
const path = require('path')
const builder = new Builder({
  commands: {
    '--make': () => {
      console.log('Running Build Process:')

      // The following are not explicitly necessary since the source,
      // assets, and destination are all being set to their defaults.
      // However; the code is written so you can supply your own
      // folder structure.
      builder.source = path.resolve('./src')
      builder.assets = path.resolve('./assets') // Relative to source!
      builder.destination = path.resolve('./dist')

      // Queue the built-in build process.
      builder.run()
    },

    '--dev': () => {
      // Build the project first
      builder.run()

      // Monitor for changes
      builder.watch((action, filepath) => {
        switch (action) {
          case 'create':
            console.log('File created:', filepath)
            builder.run()
            break

          case 'update':
            console.log('File modified:', filepath)
            builder.run()
            break

          case 'delete':
            console.log('File deleted:', filepath)
            builder.run()
            break

          default:
            console.log('Unknown file system event:', action)
        }
      })
    }
  }
})
