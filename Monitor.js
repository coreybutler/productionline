const EventEmitter = require('events').EventEmitter
const path = require('path')

/**
 * Watch the source directory for changes. Any time a change occurs,
 * the callback is executed. Running this will prevent the build from
 * exiting, so it should only be used for development automation.
 * @param  {Function} callback
 * The method to execute when a file change is detected.
 * @param {String} callback.action
 * The type of action detected. This will be `create`, `update`, or `delete`.
 * @param {String} callback.path
 * The absolute path of the file or directory that changed.
 * @return {Object}
 * Returns the monitoring object (chokidar). This has a `close()` method to
 * stop watching.
 */
class Monitor extends EventEmitter {
  constructor (builder, callback) {
    super()

    Object.defineProperties(this, {
      callback: {
        enumerable: false,
        configurable: false,
        writable: false,
        value: callback
      },

      BUILDER: {
        enumerable: false,
        configurable: false,
        writable: false,
        value: builder
      }
    })

    let watcher = require('chokidar').watch(path.join(this.BUILDER.SOURCE, '**/*'), {
      ignored: this.BUILDER.IGNOREDLIST,
      ignoreInitial: true
    })
      .on('add', filepath => this.reset('create', filepath))
      .on('change', filepath => this.reset('change', filepath))
      .on('unlink', filepath => this.reset('unlink', filepath))

    this.emit('ready', watcher)
  }

  reset () {
    this.BUILDER.tasks.steps = []
    this.BUILDER.prepareBuild()
    this.callback && this.callback(...arguments)
  }
}

module.exports = Monitor
