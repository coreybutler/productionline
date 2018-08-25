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

class FileManager {
  constructor (filepath) {
    Object.defineProperties(this, {
      PRIVATE: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: {
          filepath,
          content: null,
          lines: null,
          linecount: null,
          lineindex: new Map(),
          indexline: new Map()
        }
      }
    })

    // Make sure the file is readable
    fs.accessSync(filepath, fs.constants.R_OK)
  }

  set content (value) {
    this.PRIVATE.content = value
    this.lines = null
    this.linecount = null
  }

  get content () {
    if (this.PRIVATE.content === null) {
      this.PRIVATE.content = this.readSync()
    }

    return this.PRIVATE.content
  }

  get lines () {
    if (this.PRIVATE.lines === null) {
      this.processLines()
    }

    return this.PRIVATE.lines
  }

  get lineCount () {
    if (this.PRIVATE.linecount === null) {
      let lines = this.lines // eslint-disable-line
    }

    return this.PRIVATE.linecount || 0
  }

  get filename () {
    return path.basename(this.PRIVATE.filepath)
  }

  processLines () {
    this.PRIVATE.lines = {}

    let lines = this.content.split(/\r|\n/)
    let currentPosition = -1

    lines.forEach((content, line) => {
      currentPosition++

      let lineEnd = currentPosition + content.length - (currentPosition === 0 ? 1 : 0)

      if (lineEnd <= currentPosition) {
        lineEnd = currentPosition + 1
      }

      this.PRIVATE.lines[line + 1] = content

      let start = this.content.indexOf(content, currentPosition)
      let end = start + content.length - (currentPosition === 0 ? 1 : 0)

      this.PRIVATE.lineindex.set([start, end], line + 1)
      this.PRIVATE.indexline.set(line + 1, [start, end])

      currentPosition = end
    })

    this.PRIVATE.linecount = lines.length
  }

  readSync () {
    return fs.readFileSync(this.PRIVATE.filepath).toString()
  }

  read () {
    fs.readFile(this.PRIVATE.filepath, ...arguments)
  }

  getLine (number) {
    return this.lines[number]
  }

  // Accepts any number of indexes as arguments
  getLineByIndex () {
    let indice = {}

    // Forcibly calculate lines if they don't exist.
    if (this.PRIVATE.lines === null) {
      this.processLines()
    }

    // Sort index values, then get the line numbers
    Array.from(arguments).sort().reverse().forEach(index => {
      let line = null
      let ranges = this.PRIVATE.lineindex.entries()
      let range

      while (line === null && !(range = ranges.next()).done) {
        if (index >= range.value[0][0] && index <= range.value[0][1]) {
          line = range.value[1]
          indice[index] = line
        }
      }
    })

    return indice
  }

  // Accepts any number of lines as arguments
  getLineIndexRange () {
    let indice = {}

    // Forcibly calculate lines if they don't exist.
    if (this.PRIVATE.lines === null) {
      this.processLines()
    }

    // Sort index values, then get the line numbers
    Array.from(arguments).sort().reverse().forEach(line => {
      indice[line] = this.PRIVATE.indexline.get(line)
    })

    return indice
  }

  getSnippet (start, end) {
    let snippet = []

    for (let i = start; i <= end; i++) {
      snippet.push(this.lines[i])
    }

    return snippet.join('\n')
  }

  /**
   * Similar to Array#forEach, except it passes the line content, line number, and full line object.
   * @param  {Function} fn
   */
  forEachLine (fn) {
    for (let line = 1; line <= this.lineCount; line++) {
      fn(this.PRIVATE.lines[line], line, this.PRIVATE.lines)
    }
  }
}

/**
 * @class ProductionLine.Builder
 * A queueing and execution system.
 * @extends EventEmitter
 */
class Builder extends EventEmitter {
  constructor (cfg = {}) {
    super()

    /**
     * @cfg {boolean} [checkForUpdates=true]
     * Check for updates to the module.
     */
    this.CHECKFORUPDATES = typeof cfg.checkForUpdates === 'boolean' ? cfg.checkForUpdates : true

    this.tasks = new TaskRunner()

    this.PKG = require(path.join(process.cwd(), 'package.json'))

    // Metadata
    this.APPVERSION = this.PKG.version

    /**
     * @cfg {string} [header]
     * A standard header to be applied to files.
     * Defaults to
     * ```sh
     * Copyright (c) <DATE> <AUTHOR> and contributors. All Rights Reserved.
     * Version X.X.X built on <DATE>.
     * ```
     * If a project name is available in the local package.json, this will default to:
     *
     * ```
     * <PROJECT NAME> vX.X.X generated on <DATE>.
     * Copyright (c) <DATE> <AUTHOR> and contributors. All Rights Reserved.
     * [LICENSE: <LICENSE TEXT>]
     * ```
     * _Notice the optional license._ If a license is supplied in the package.json,
     * the it will be applied to the header. This only applies the name of the license
     * (as i.e. license attribute of package.json). It does not read a license file
     * into the header.
     */
    this.HEADER = cfg.header || `Copyright (c) ${(new Date()).getFullYear()} ${this.author} and contributors. All Rights Reserved.${this.package.hasOwnProperty('license') ? '\nLICENSE: ' + this.package.license : ''}`

    if (this.name !== 'Untitled') {
      this.HEADER = `${this.name} v${this.version} generated on ${(new Date().toDateString())}.\n` + this.HEADER
    } else {
      this.HEADER = `${this.HEADER}\nVersion ${this.version} built on ${(new Date().toDateString())}.`
    }

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

    if (typeof this.ASSETS === 'string') {
      this.ASSETS = [this.ASSETS]
    }

    /**
     * @cfg {string} [ignoredList=node_modules]
     * A list of directories to ignore.
     */
    this.IGNOREDLIST = cfg.ignoredList || [
      'node_modules/**/*'
    ]

    // Find .gitignore and .buildignore. Add them to the ignored list.
    this.ignoreFile(path.join(process.cwd(), '.gitignore'))
    this.ignoreFile(path.join(process.cwd(), '.buildignore'))

    try {
      if (cfg.ignore) {
        if (!Array.isArray(cfg.ignore)) {
          cfg.ignore = [cfg.ignore]
        }

        this.IGNOREDLIST = this.IGNOREDLIST.concat(cfg.ignore)
      }
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
              padding: [1, 0, 1, 5]
            })

            ui.div({
              text: chalk.bold('Source:'),
              width,
              padding: [0, 0, 0, 5]
            }, {
              text: this.SOURCE
            })

            ui.div({
              text: chalk.bold('Output:'),
              width,
              padding: [0, 0, 0, 5]
            }, {
              text: this.OUTPUT
            })

            ui.div({
              text: chalk.bold('Assets:'),
              width,
              padding: [0, 0, 0, 5]
            }, {
              text: this.ASSETS.map(asset => path.join(this.SOURCE, asset)).join('\n')
            })

            ui.div({
              text: this.COLORS.subtle('Ignored:'),
              width,
              padding: [1, 0, 1, 5]
            }, {
              text: this.COLORS.subtle(this.IGNOREDLIST.join(', ')),
              padding: [1, 0, 1, 0]
            })

            this.checkForUpdate(() => {
              console.log(ui.toString())
              next()
            })
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

      CURRENT_STEP: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: 0
      },

      TIMER: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: {
          total: null,
          markers: new Map()
        }
      },

      REPORT: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: []
      },

      NOTIFIED_OF_UPDATE: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: false
      },

      MODULE_NAME: {
        enumerable: false,
        configurable: false,
        writable: true,
        value: path.basename(__dirname)
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

  get name () {
    if (this.PKG.hasOwnProperty('name')) {
      return this.PKG.name
    }

    return 'Untitled'
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
    let oldpath = this.SOURCE
    let newpath = path.resolve(value)

    if (oldpath === newpath) {
      return
    }

    try {
      fs.accessSync(newpath, fs.constants.R_OK)
    } catch (e) {
      this.warn(`SOURCE DIRECTORY NOT FOUND: "${newpath}"`)
    }

    this.SOURCE = newpath
    this.emit('source.updated', {
      old: oldpath,
      new: newpath
    })
  }

  get output () {
    return this.OUTPUT
  }

  set output (value) {
    let oldpath = this.OUTPUT
    let newpath = path.resolve(value)

    if (oldpath === newpath) {
      return
    }

    try {
      fs.accessSync(newpath, fs.constants.R_OK)
    } catch (e) {
      this.warn(`OUTPUT DIRECTORY NOT FOUND: "${newpath}"`)
    }

    this.OUTPUT = newpath
    this.emit('output.updated', {
      old: oldpath,
      new: newpath
    })
  }

  set destination (value) {
    this.output = path.resolve(value)
  }

  get destination () {
    return this.OUTPUT
  }

  set assets (value) {
    this.ASSETS = typeof value === 'string' ? [value] : value
  }

  get assets () {
    return this.ASSETS
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

  get File () {
    return FileManager
  }

  get SemanticVersion () {
    return require('semver')
  }

  // Retrieves the latest version number for the specified module.
  checkModuleVersion (moduleName, callback) {
    require('child_process').exec(`npm info ${moduleName} --json`, (err, data) => {
      if (err) {
        return callback(err)
      }

      try {
        callback(null, JSON.parse(data).version)
      } catch (e) {
        callback(e)
      }
    })
  }

  checkForUpdate (callback) {
    if (this.CHECKFORUPDATES && !this.NOTIFIED_OF_UPDATE) {
      this.NOTIFIED_OF_UPDATE = true

      this.checkModuleVersion(this.MODULE_NAME, (err, latestVersion) => {
        if (!err) {
          let currentVersion = this.version

          if (this.MODULE_NAME !== this.name) {
            currentVersion = require(path.join(process.cwd(), 'node_modules', this.MODULE_NAME, 'package.json')).version
          }

          if (this.SemanticVersion.lt(currentVersion, latestVersion)) {
            console.log(this.COLORS.warn(`\n  ** An update for ${this.MODULE_NAME} is available (${currentVersion} ==> `) + this.COLORS.success(latestVersion) + this.COLORS.warn(') **\n'))
          }
        }

        callback && callback()
      })
    } else {
      callback && callback()
    }
  }

  identifyOutdatedModules (type = 'all', callback) {
    if (this.CHECKFORUPDATES && this.PKG) {
      let pkgModules = {}
      let updateTasks = new TaskRunner()
      let list = []

      if ((type === 'all' || type === 'production') && this.PKG.hasOwnProperty('dependencies')) {
        list = Object.keys(this.PKG.dependencies)
      }

      if ((type === 'all' || type === 'development') && this.PKG.hasOwnProperty('devDependencies')) {
        list = list.concat(Object.keys(this.PKG.devDependencies))
      }

      list.forEach(mod => {
        updateTasks.add(cont => {
          this.checkModuleVersion(mod, (err, version) => {
            let currentVersion = require(path.join(process.cwd(), 'node_modules', mod, 'package.json')).version

            if (!err && this.SemanticVersion.lt(currentVersion, version)) {
              pkgModules[mod] = {
                current: currentVersion,
                latest: version
              }
            }

            cont()
          })
        })
      })

      updateTasks.on('complete', () => {
        let mods = Object.keys(pkgModules)

        if (mods.length > 0) {
          let ui = new this.Table()

          ui.div({
            text: chalk.bold('Outdated Module'),
            width: 20,
            padding: [0, 0, 0, 3]
          }, {
            text: chalk.bold('Current'),
            width: 10,
            padding: [0, 0, 0, 0],
            align: 'right'
          }, {
            text: '',
            width: 5,
            padding: [0, 1, 0, 1]
          }, {
            text: chalk.bold('Latest'),
            width: 10,
            padding: [0, 0, 0, 0],
            align: 'left'
          })

          mods.forEach(mod => {
            ui.div({
              text: chalk.bold(this.COLORS.warn(mod)),
              width: 20,
              padding: [0, 0, 0, 3]
            }, {
              text: chalk.bold(this.COLORS.warn(pkgModules[mod].current)),
              width: 10,
              padding: [0, 0, 0, 0],
              align: 'right'
            }, {
              text: this.COLORS.verysubtle('==>'),
              width: 5,
              padding: [0, 1, 0, 1]
            }, {
              text: chalk.bold(this.COLORS.success(pkgModules[mod].latest)),
              width: 10,
              padding: [0, 0, 0, 0],
              align: 'left'
            })
          })

          console.log(ui.toString())
        }
      })

      updateTasks.run()
    }
  }

  /**
   * Ignore the contents of the specified file.
   * This is automatically done for `.buildignore` and `.gitignore`.
   * @param  {[type]} file [description]
   * @return {[type]}      [description]
   */
  ignoreFile (file) {
    try {
      this.IGNOREDLIST = this.IGNOREDLIST.concat(fs.readFileSync(path.resolve(file)).toString()
        .replace(/#.*/gi, '')
        .split(require('os').EOL)
        .filter(glob => {
          if (glob.trim().charAt(0) === '!') {
            return false
          }

          return glob.trim().length > 0
        }))
    } catch (e) {}
  }

  /**
   * A rounding method (like Math.round) that rounds to
   * a specific number of decimal points.
   * @param  {number} number
   * A float (decimal) number.
   * @param  {number} precision
   * The number of decimal places.
   * @return {number}
   */
  round (number, precision) {
    const factor = Math.pow(10, precision)
    return Math.round(number * factor) / factor
  }

  // Returns the minimum number decimal places required to
  // show a non-zero result.
  minSignificantFigures () {
    let min = 0

    for (let i = 0; i < arguments.length; i++) {
      let value = Math.abs(arguments[i]).toString().split('.').pop()

      for (let x = 0; x < value.length; x++) {
        if (value.charAt(x) !== '0') {
          min = x > min ? x : min
          break
        }
      }
    }

    return min + 1
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
    if (path.resolve(inputFilepath) !== inputFilepath) {
      inputFilepath = path.join(this.OUTPUT, inputFilepath)
    }

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
    let sourcePath = path.join(this.SOURCE, filepath).replace(new RegExp(`(${this.SOURCE}){2,100}`), this.SOURCE)
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
      } else if (this.COMMANDS.hasOwnProperty('default') && typeof this.COMMANDS.default === 'function') {
        this.COMMANDS.default.apply(this, args)
      }
    }
  }

  /**
   * An overridable method that can be used to add tasks before all other tasks.
   */
  before () {
    // Validate source
    try {
      fs.accessSync(this.SOURCE, fs.constants.F_OK)
    } catch (e) {
      this.failure(`  CANNOT FIND SOURCE DIRECTORY: "${this.SOURCE}"`)
    }

    // Validate assets
    if (this.ASSETS !== null && this.ASSETS.length > 0) {
      this.ASSETS.forEach((assetDirectory, i) => {
        this.ASSETS[i] = path.resolve(assetDirectory)

        try {
          fs.accessSync(this.ASSETS[i], fs.constants.F_OK)
        } catch (e) {
          this.warn(`  CANNOT FIND ASSET DIRECTORY: "${this.ASSETS[i]}"`)
        }
      })
    }
  }

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
  stepStarted (step) {
    if (step.name !== '::EXECUTIONREPORT::') {
      this.CURRENT_STEP++

      let ui = new CLITable()

      ui.div({
        text: this.CURRENT_STEP,
        width: 3,
        padding: [0, 0, 0, 2]
      }, {
        text: ')',
        width: 2
      }, {
        text: this.COLORS.log(`${step.name}`)
      })

      console.log(ui.toString())

      this.startTime(step.name || `STEP ${step.number}`)

      this.emit('step.started', step)
    }
  }

  complete (callback) {
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

    this.tasks.removeAllListeners()
  }

  startTimer () {
    this.startTime('::PRODUCTIONLINE_START::')
  }

  startTime (label) {
    if (!label || (typeof label !== 'string' && typeof label !== 'number')) {
      throw new Error('startTime method requires a label argument.')
    }

    this.TIMER.markers.set(label, {
      start: new Date(),
      mark: process.hrtime(),
      get end () {
        return new Date(this.start.getTime() + (this.duration * 1000))
      },
      get duration () {
        let diff = process.hrtime(this.mark)
        // Convert nanoseconds to seconds
        return ((diff[0] * 1e9) + diff[1]) / 1000000000 // 1000000 nanoseconds per millisecond
      }
    })
  }

  timeSince (label) {
    let marker = this.TIMER.markers.get(label)

    if (marker === null) {
      throw new Error(`"${label}" does not exist in the timer.`)
    }

    return marker.duration
  }

  run (sequential = true, callback) {
    if (typeof sequential === 'function') {
      callback = sequential
      sequential = true
    }

    this.prepareBuild()

    this.startTimer()

    this.before()

    this.CURRENT_STEP = 0

    this.tasks.on('stepstarted', step => this.stepStarted(step))

    this.tasks.on('stepcomplete', step => {
      if (step.name !== '::EXECUTIONREPORT::') {
        let label = step.name || `STEP ${step.number}`
        let timer = this.TIMER.markers.get(label)
        let duration = timer.duration

        this.REPORT.push({
          label,
          number: step.number,
          start: timer.start,
          end: new Date(timer.start.getTime() + (duration * 1000)),
          duration
        })

        this.emit('step.complete', step)
      }
    })

    this.tasks.on('complete', () => this.complete(callback))

    // "Before" tasks are applied in the constructor.
    if (!this.monitoring) {
      this.cli()
    }

    this.after()

    this.tasks.add('::EXECUTIONREPORT::', () => {
      this.TIMER.total = this.timeSince('::PRODUCTIONLINE_START::')
      this.verysubtle(`\n  Process completed in ${this.TIMER.total} seconds.\n\n`)
    })

    this.tasks.run(sequential)
  }

  displayReport () {
    let report = this.report
    let ui = new this.Table()
    let width = 15

    ui.div({
      text: chalk.bold(this.COLORS.info(`${report.name} v${report.version} Execution Report`.toUpperCase())),
      padding: [1, 0, 0, 3]
    })

    ui.div({
      text: this.COLORS.verysubtle(`Ran ${report.taskCount} task${report.taskCount !== 1 ? 's' : ''} for ${report.duration} seconds (from ${report.start.toLocaleTimeString()} to ${report.end.toLocaleTimeString()}).`),
      padding: [0, 0, 1, 3]
    })

    ui.div({
      text: 'Source:',
      width,
      padding: [0, 0, 0, 3]
    }, {
      text: this.SOURCE
    })

    ui.div({
      text: 'Output:',
      width,
      padding: [0, 0, 0, 3]
    }, {
      text: this.OUTPUT
    })

    ui.div({
      text: 'Assets:',
      width,
      padding: [0, 0, 0, 3]
    }, {
      text: this.ASSETS.map(asset => path.join(this.SOURCE, asset)).join('\n')
    })

    ui.div({
      text: this.COLORS.subtle('Ignored:'),
      width,
      padding: [1, 0, 1, 3]
    }, {
      text: this.COLORS.subtle(this.IGNOREDLIST.join(', ')),
      padding: [1, 0, 1, 0]
    })

    ui.div({
      text: chalk.bold(this.COLORS.info('TASK EXECUTION SUMMARY:')),
      padding: [1, 0, 0, 3]
    })

    let sigfigs = this.minSignificantFigures.apply(this, report.tasks.map(step => step.duration))
    sigfigs = sigfigs < 2 ? 2 : sigfigs

    report.tasks.forEach(step => {
      let duration = step.duration

      ui.div({
        text: step.number,
        width: 3 + (report.tasks.length > 99 ? 3 : (report.tasks.length > 9 ? 2 : 1)),
        align: 'right',
        padding: [1, 0, 1, 3]
      }, {
        text: ')',
        width: 2,
        padding: [1, 1, 0, 0]
      }, {
        text: chalk.bold(step.label),
        width: 45,
        padding: [1, 0, 1, 0]
      }, {
        text: this.COLORS[duration > 2 ? (duration > 10 ? (duration > 20 ? 'highlight' : 'warn') : 'subtle') : 'verysubtle'](`${this.round(duration, sigfigs)} seconds.`),
        width: 20,
        padding: [1, 0, 1, 3]
      })
    })

    console.log(ui.toString() + '\n\n')
  }

  get report () {
    let report = { tasks: [] }
    let monitor = this.TIMER.markers.get('::PRODUCTIONLINE_START::')

    report.start = monitor.start
    report.end = monitor.end
    report.duration = monitor.duration

    this.REPORT.forEach(step => report.tasks.push(step))

    report.name = this.name
    report.version = this.version
    report.source = this.SOURCE
    report.output = this.OUTPUT
    report.assets = this.ASSETS
    report.ignored = this.IGNOREDLIST
    report.taskCount = report.tasks.length
    report.createDate = new Date()

    return report
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
        setTimeout(() => this.verysubtle(`  Monitoring ${this.SOURCE} for changes. Press ctrl+c to exit.\n`), 600)
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
