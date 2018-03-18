const TaskRunner = require('shortbus')
const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')
const minimatch = require('minimatch')
const chalk = require('chalk')
const CLITable = require('cliui')
const localpackage = require('./package.json')
const Monitor = require('./Monitor')
const EventEmitter = require('events').EventEmitter

/**
 * @class ProductionLine.Builder
 * A queueing and execution system.
 * @extends EventEmitter
 */
class Builder extends EventEmitter {
  constructor (cfg = {}) {
    super()

    this.tasks = new TaskRunner()

    this.PKG = require(path.join(process.cwd(), 'package.json'))

    // Metadata
    this.APPVERSION = this.PKG.version

    /**
     * @cfg {string} [header]
     * A standard header to be applied to files.
     * Defaults to "Copyright (c) <DATE> <AUTHOR>. All Rights Reserved.\nVersion X.X.X built on <DATE>."
     */
    this.HEADER = cfg.header || `Copyright (c) ${(new Date()).getFullYear()} ${this.author}. All Rights Reserved.\nVersion ${this.version} built on ${new Date().toDateString()}.`

    /**
     * @cfg {string} [footer]
     * A standard footer to be applied to files. Defaults to blank.
     */
    this.FOOTER = null

    this.COLORS = {
      failure: chalk.bold.rgb(214, 48, 49),
      warn: chalk.bold.rgb(225, 112, 85),
      info: chalk.rgb(116, 185, 255),
      log: chalk.rgb(223, 230, 233),
      highlight: chalk.bold.rgb(232, 67, 147),
      success: chalk.bold.rgb(85, 239, 196),
      subtle: chalk.rgb(99, 110, 114),
      verysubtle: chalk.rgb(45, 52, 54)
    }

    // Filepaths
    /**
     * @cfg {string} [source=./src]
     * The root directory containing source files.
     */
    this.SOURCE = path.resolve(cfg.source || './src')

    /**
     * @cfg {string} [output=./dist]
     * The root directory where output files will be stored.
     * This will be created if it does not already exist.
     */
    this.OUTPUT = path.resolve(cfg.output || './dist')

    /**
     * @cfg {string} [assets=./assets]
     * The root directory containing non-buildable assets such as multimedia.
     */
    this.ASSETS = cfg.assets || [
      './assets'
    ]

    /**
     * @cfg {string} [ignoredList=node_modules]
     * A list of directories to ignore.
     */
    this.IGNOREDLIST = cfg.ignoredList || [
      'node_modules/**/*'
    ]

    // Find .gitignore and .buildignore. Add them to the ignored list.
    try {
      this.IGNOREDLIST = this.IGNOREDLIST.concat(
        fs.readFileSync(path.join(process.cwd(), '.gitignore')).toString()
          .replace(/#.*/gi, '')
          .split(require('os').EOL)
          .filter(glob => {
            if (glob.trim().charAt(0) === '!') {
              return false
            }

            return glob.trim().length > 0
          }))
    } catch (e) {}

    try {
      this.IGNOREDLIST = this.IGNOREDLIST.concat(
        fs.readFileSync(path.join(process.cwd(), '.buildignore')).toString()
          .replace(/#.*/gi, '')
          .split(require('os').EOL)
          .filter(glob => {
            if (glob.trim().charAt(0) === '!') {
              return false
            }

            return glob.trim().length > 0
          }))
    } catch (e) {}

    // Helper tool for custom logging.
    this.joinArguments = args => {
      let out = []

      for (let i = 0; i < args.length; i++) {
        out.push(args[i])
      }

      return out.join(' ')
    }

    let width = 15

    // Initialize tasks.
    Object.defineProperties(this, {
      prepareBuild: {
        enumerable: false,
        writable: true,
        configurable: true,
        value: () => {
          this.tasks.add('Preparing Build', next => {
            let ui = new CLITable()

            ui.div({
              text: this.COLORS.info(`Running ${localpackage.name} v${localpackage.version} for ${this.PKG.name}`),
              border: false,
              padding: [1, 0, 1, 2]
            })

            ui.div({
              text: chalk.bold('Source:'),
              width,
              padding: [0, 0, 0, 2]
            }, {
              text: this.SOURCE
            })

            ui.div({
              text: chalk.bold('Output:'),
              width,
              padding: [0, 0, 0, 2]
            }, {
              text: this.OUTPUT
            })

            ui.div({
              text: chalk.bold('Assets:'),
              width,
              padding: [0, 0, 0, 2]
            }, {
              text: this.ASSETS.map(asset => path.join(this.SOURCE, asset)).join('\n')
            })

            ui.div({
              text: this.COLORS.subtle('Ignored:'),
              width,
              padding: [1, 0, 1, 2]
            }, {
              text: this.COLORS.subtle(this.IGNOREDLIST.join(', ')),
              padding: [1, 0, 1, 0]
            })

            console.log(ui.toString())

            next()
          })
        }
      },

      LOCAL_MONITOR: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: null
      },

      COMMANDS: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: cfg.commands || null
      },

      CLI_ARGUMENTS: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: null
      },

      /**
       * @property {Class} TaskRunner
       * A [Shortbus](https://github.com/coreybutler/shortbus) task runner.
       */
      TaskRunner: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: TaskRunner
      },

      minimatch: {
        enumerable: false,
        configurable: false,
        writable: false,
        value: minimatch
      }
    })

    this.prepareBuild()

    this.before()
  }

  get package () {
    return this.PKG
  }

  get author () {
    // No author?
    if (!this.PKG.hasOwnProperty('author')) {
      return require('os').userInfo().username
    }

    // Author specified as a string
    if (typeof this.PKG.author === 'string') {
      return this.PKG.author
    }

    // No name?
    if (!this.PKG.author.hasOwnProperty('name')) {
      return require('os').userInfo().username
    }

    // Has a name
    return this.PKG.author.name
  }

  get version () {
    return this.APPVERSION
  }

  set header (value) {
    if (value === null || value === undefined) {
      delete this.HEADER
      return
    }

    this.HEADER = value
  }

  set footer (value) {
    if (value === null || value === undefined) {
      delete this.FOOTER
      return
    }

    this.FOOTER = value
  }

  get source () {
    return this.SOURCE
  }

  set source (value) {
    this.SOURCE = value
  }

  set destination (value) {
    this.OUTPUT = value
  }

  get destination () {
    return this.OUTPUT
  }

  set assets (value) {
    this.ASSETS = value
  }

  get Table () {
    return CLITable
  }

  /**
   * Set the list of paths to ignore (supports glob patterns).
   * If you only want to add to the list, use #ignorePath instead.
   * By default, `node_modules` is ignored, as well as anything
   * in the ``.gitignore` file (if it exists) or a `.buildignore`
   * file (if it exists).
   * @param  {Array} paths
   * An array of paths to ignore in the build process.
   */
  set ignore (value) {
    this.IGNOREDLIST = value
  }

  /**
   * Provides a reference to the watcher.
   */
  get monitor () {
    return this.LOCAL_MONITOR
  }

  /**
   * @property {Boolean}
   * @readonly
   * Indicates the builder is in "watch" mode (monitoring the file system)
   */
  get monitoring () {
    return this.LOCAL_MONITOR !== null
  }

  /**
   * @property {array}
   * @readonly
   * Returns the CLI arguments passed to the builder.
   */
  get cliarguments () {
    return this.CLI_ARGUMENTS
  }

  /**
   * Empty the output directory.
   */
  clean () {
    fs.emptyDir(this.OUTPUT)
  }

  /**
   * This adds directories and/or files to the list of ignored files,
   * where as setting the ignore property overrides the whole list.
   * @param  {String|Array} paths
   * The path(s) to add to the list of ignored paths.
   */
  ignorePath (dir) {
    if (typeof dir === 'string') {
      this.IGNOREDLIST.push(dir)
    } else if (dir.length > 0) {
      this.IGNOREDLIST = this.IGNOREDLIST.concat(dir)
    }
  }

  /**
   * Retrieves all files (recursively) within a directory.
   * Supports glob patterns.
   * @param  {string} directory
   * The directory to walk.
   * @return {Array}
   * An array containing the absolute path of each file in the directory.
   */
  walk (directory, ignore = []) {
    if (!directory) {
      return []
    }

    let ignored = this.IGNOREDLIST.concat(ignore)

    // Support globbing
    if (glob.hasMagic(directory)) {
      let root = './'

      if (directory.startsWith(this.SOURCE)) {
        root = this.SOURCE
        directory = directory.replace(this.SOURCE, '')
      } else if (directory.startsWith(this.OUTPUT)) {
        root = this.OUTPUT
        directory = directory.replace(this.OUTPUT, '')
      }

      return glob.sync(directory, {
        cwd: root,
        root,
        ignore: ignored
      })
    }

    // Walk the directory without globbing
    let files = []

    fs.readdirSync(directory).forEach(dir => {
      let process = true

      for (let i = 0; i < ignored.length; i++) {
        if (minimatch(path.join(directory, dir), `/**/${ignored[i]}`)) {
          process = false
          break
        }
      }

      if (process) {
        if (fs.statSync(path.join(directory, dir)).isDirectory()) {
          files = files.concat(this.walk(path.join(directory, dir)))
        } else {
          files.push(path.join(directory, dir))
        }
      }
    })

    return files
  }

  /**
   * Read a file and autoconvert bytecode to a string.
   * @param  {String} filepath
   * Absolute path of the input file.
   * @param {Function} callback
   * The content of the file is passed as the only attribute to the callback.
   * If an error occurs, it is thrown.
   */
  readFile (filepath, callback) {
    fs.readFile(filepath, (err, content) => {
      if (err) {
        throw err
      }

      callback(content.toString().trim())
    })
  }

  /**
   * Read a file and autoconvert bytecode to a string.
   * @param  {String} filepath
   * Absolute path of the input file.
   * @return {String}
   * The content of the file.
   */
  readFileSync (filepath) {
    return fs.readFileSync(filepath).toString().trim()
  }

  /**
   * Write a file to disk.
   * Almost the same as fs.writeFileSync (i.e. it overwrites),
   * except if the parent directory does not exist, it's created.
   * Accepts the same parameters as fs.writeFileSync.
   */
  writeFileSync () {
    fs.outputFileSync(...arguments)
  }

  /**
   * Create the same path in the output directory as the input directory.
   * @param  {string} inputFilepath
   * The path to mimic in the output directory.
   * @return {string}
   * The corresponding output path.
   */
  outputDirectory (inputFilepath) {
    return inputFilepath.replace(this.SOURCE, this.OUTPUT)
  }

  /**
   * Opposite of the output() method.
   * @param  {string} outputFilepath
   * The output path to mimic in the source/input directory.
   * @return {string}
   * The corresponding input path.
   */
  localDirectory (outFilepath) {
    return outFilepath.replace(this.SOURCE, '').replace(this.OUTPUT, '')
  }

  /**
   * The path, stripped of the preceding source/destination path.
   * This is promarily used to create a _relative_ path.
   * @param  {String} path
   * Abosulute/full path of the file.
   * @return {String}
   * The relative path from either the source or destination.
   */
  relativePath (filepath) {
    return ('./' + filepath.replace(this.SOURCE, '').replace(this.OUTPUT, '').trim()).replace(/\/{2,100}/, '/')
  }

  /**
   * Apply text as a header to a file. This injects a comment at the top of
   * the file, based on the content supplied to #header.
   * @param  {String} code
   * The code/content to inject the header above.
   * @param  {String} [type='sh']
   * The type of file. Supported values include `sh`, `sql`, `js`, `css`, and `html`.
   * @return {String}
   * Returns the code with the header content applied.
   */
  applyHeader (code, type = 'js') {
    if (!this.HEADER) {
      return code
    }

    let msg = this.HEADER.split('\n')

    switch (type.trim().toLowerCase()) {
      case 'htm':
      case 'html':
        return '<!--\n' + msg.join('\n') + '\n-->\n' + code

      case 'css':
      case 'js':
        if (msg.length === 1) {
          return `// ${msg[0]}\n${code}`
        }

        return '/**\n' + msg.map(line => ` * ${line}`).join('\n') + '\n */\n' + code

      case 'sql':
        if (msg.length === 1) {
          return `-- ${msg[0]}\n${code}`
        }

        return '/*\n' + msg.join('\n') + '\n*/\n' + code

      case 'sh':
        return msg.map(line => `# ${line}`).join('\n')
    }
  }

  /**
   * Apply text as a header to a file. This injects a comment at the top of
   * the file, based on the content supplied to #footer.
   * @param  {String} code
   * The code/content to inject the footer below.
   * @param  {String} [type='sh']
   * The type of file. Supported values include `sh`, `sql`, `js`, `css`, and `html`.
   * @return {String}
   * Returns the code with the header content applied.
   */
  applyFooter (code, type = 'js') {
    if (!this.FOOTER) {
      return code
    }

    let msg = this.FOOTER.split('\n')

    switch (type.trim().toLowerCase()) {
      case 'htm':
      case 'html':
        return code + '\n<!--\n' + msg.join('\n') + '\n-->\n'

      case 'css':
      case 'js':
        if (msg.length === 1) {
          return `${code}\n// ${msg[0]}\n`
        }

        return code + '\n/**\n' + msg.map(line => ` * ${line}`).join('\n') + '\n */\n'

      case 'sql':
        if (msg.length === 1) {
          return `${code}\n-- ${msg[0]}\n`
        }

        return code + '\n/*\n' + msg.join('\n') + '\n*/\n'

      case 'sh':
        return msg.map(line => `# ${line}`).join('\n')
    }
  }

  // Writes a file, guaranteeing the specified output directory exists.
  writeFile (filepath, content, callback) {
    fs.ensureDir(path.dirname(filepath), () => fs.writeFile(...arguments))
  }

  /**
   * An asynchronous method to copy a source file to the output.
   * @param  {String} filepath
   * The relative path (from source) of the file to copy to the output directory.
   * @param  {Function} callback
   */
  copyToOutput (filepath, callback) {
    let sourcePath = path.join(this.SOURCE, filepath)
    let outputPath = this.outputDirectory(sourcePath)

    fs.copy(sourcePath, outputPath, callback)
  }

  /**
   * Add a custom named task.
   *
   * ```js
   * ProductionLine.customStep(function (next) {
   *   // .. do something ..
   *   next() // Advances to the next step.
   * })
   * ```
   * @param {string} [stepName]
   * An optional argument containing the step name.
   * @param {function} callback
   * The function containing the logic of the step.
   * @param {function} callback.next
   * The method to call when to complete an asynchronous step.
   */
  addTask () {
    this.tasks.add(...arguments)
  }

  cli () {
    // Support commands
    let args = process.argv.slice(2)
    this.CLI_ARGUMENTS = args

    if (args.length > 0 && this.COMMANDS !== null) {
      if (this.COMMANDS.hasOwnProperty(args[0])) {
        if (typeof this.COMMANDS[args[0]] !== 'function') {
          return console.log(`${args[0]} flag does not have a valid function associated with it.`)
        }

        this.COMMANDS[args[0]].apply(this, args)
      }
    }
  }

  /**
   * An overridable method that can be used to add tasks before all other tasks.
   */
  before () {}

  /**
   * An overridable method that can be used to add tasks after all other tasks.
   */
  after () {}

  /**
   * Run the all of the tasks in the production/assembly line.
   * @param  {Boolean} [sequential=true]
   * By default, all tasks are run in sequential order (one after the other).
   * This can be set to `false` to run them all in parallel. Remember, running
   * in parallel does not guarantee an order, so it is entirely possible to
   * run all tasks and then have the #clean task wipe everything out. This
   * option is here specifically for build pipelines that are designed for
   * parallel processing.
   */
  run (sequential = true, callback) {
    if (typeof sequential === 'function') {
      callback = sequential
      sequential = true
    }

    let counter = 0
    this.tasks.on('stepstarted', step => {
      counter++

      let ui = new CLITable()

      ui.div({
        text: counter,
        width: 3,
        padding: [0, 0, 0, 2]
      }, {
        text: ')',
        width: 2
      }, {
        text: this.COLORS.log(`${step.name}`)
      })

      console.log(ui.toString())

      this.emit('step.started', step)
    })

    this.tasks.on('stepcompleted', step => this.emit('step.complete', step))

    this.tasks.on('complete', () => {
      let ui = new CLITable()

      ui.div({
        text: this.COLORS.log('Complete.'),
        padding: [1, 2, 1, 2]
      })

      console.log(ui.toString())

      // Fire the callback if it exists
      callback && callback()

      // Trigger the completion event.
      this.emit('complete')
    })

    // "Before" tasks are applied in the constructor.
    if (!this.monitoring) {
      this.cli()
    }

    this.after()

    this.tasks.run(sequential)
  }

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
   * @fires watch
   * Triggered when the monitor starts. Sends a chokidar instance as a payload.
   */
  watch (callback) {
    if (this.LOCAL_MONITOR === null) {
      // Intentionally delay the start of the watch so the builder initializes.
      setTimeout(() => {
        this.LOCAL_MONITOR = new Monitor(this, callback)
        this.emit('watch', this.LOCAL_MONITOR)
      }, 100)
    }
  }

  /**
   * A special color-coded (red) console logger. Behaves the same as `console.log`
   */
  failure () {
    console.log(this.COLORS.failure(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (orange) console logger. Behaves the same as `console.log`
   */
  warn () {
    console.log(this.COLORS.warn(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (light blue) console logger. Behaves the same as `console.log`
   */
  info () {
    console.log(this.COLORS.info(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (almost white) console logger. Behaves the same as `console.log`
   */
  log () {
    console.log(this.COLORS.log(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (bright pink) console logger. Behaves the same as `console.log`
   */
  highlight () {
    console.log(this.COLORS.highlight(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (tea green) console logger. Behaves the same as `console.log`
   */
  success () {
    console.log(this.COLORS.success(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (gray) console logger. Behaves the same as `console.log`
   */
  subtle () {
    console.log(this.COLORS.subtle(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (dark gray) console logger. Behaves the same as `console.log`
   */
  verysubtle () {
    console.log(this.COLORS.verysubtle(this.joinArguments(arguments)))
  }
}

module.exports = Builder
