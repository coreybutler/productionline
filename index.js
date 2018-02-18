const TaskRunner = require('shortbus')
const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')
const minimatch = require('minimatch')
const babel = require('babel-core')
const minifier = require('uglify-js')
const CleanCSS = require('clean-css')
const chalk = require('chalk')
const table = require('cliui')
const localpackage = require('./package.json')

class Builder {
  constructor () {
    this.tasks = new TaskRunner()

    this.PKG = require(path.join(process.cwd(), 'package.json'))

    // Metadata
    this.APPVERSION = this.PKG.version
    this.HEADER = `Copyright (c) ${(new Date()).getFullYear()} ${this.author}. All Rights Reserved.\nVersion ${this.version} built on ${new Date().toDateString()}.`
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
    this.SOURCE = path.resolve('./src')
    this.OUTPUT = path.resolve('./dist')
    this.ASSETS = [
      './assets'
    ]
    this.IGNOREDLIST = [
      'node_modules/**/*'
    ]

    // Find .gitignore and .buildignore. Add them to the ignored list.
    this.IGNOREDLIST = this.IGNOREDLIST.concat(
      (fs.readFileSync(path.join(process.cwd(), '.gitignore')).toString()
      + fs.readFileSync(path.join(process.cwd(), '.buildignore')).toString())
      .replace(/\#.*/gi, '')
      .split(require('os').EOL)
      .filter(glob => {
        if (glob.trim().charAt(0) === '!') {
          return false
        }

        return glob.trim().length > 0
      })
    )

    // Helper tool for custom logging.
    this.joinArguments = args => {
      let out = []

      for (let i = 0; i < args.length; i++) {
        out.push(args[i])
      }

      return out.join(' ')
    }

    // Initialize tasks.
    this.tasks.add('Preparing Build', next => {
      let ui = new table()

      ui.div({
        text: this.COLORS.info(`Running ${localpackage.name} v${localpackage.version} for ${this.PKG.name}`),
        border: false,
        padding: [1, 0, 1, 2]
      })

      ui.div({
        text: chalk.bold('Source:'),
        width: 12,
        padding: [0, 0, 0, 2]
      }, {
        text: this.SOURCE
      })

      ui.div({
        text: chalk.bold('Output:'),
        width: 12,
        padding: [0, 0, 0, 2]
      }, {
        text: this.OUTPUT
      })

      ui.div({
        text: chalk.bold('Assets:'),
        width: 12,
        padding: [0, 0, 0, 2]
      }, {
        text: this.ASSETS.map(asset => path.join(this.SOURCE, asset)).join('\n')
      })

      ui.div({
        text: this.COLORS.subtle('Ignored:'),
        width: 12,
        padding: [1, 0, 1, 2]
      }, {
        text: this.COLORS.subtle(this.IGNOREDLIST.join(', ')),
        padding: [1, 0, 1, 0]
      })

      console.log(ui.toString())

      next()
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
    return table
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

      for (let i = 0 ; i < ignored.length; i++) {
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

  // transpile (filepath callback) {
  //   fs.readFile(filepath, (err, content) => {
  //     callback(babel.transform(content, {
  //       presets: ['env']
  //     }))
  //   })
  // }

  /**
   * Synchronously transpile JavaScript code using Babel.
   * By default, this uses `presets: ['env']`.
   * @param  {[type]} filepath [description]
   * @return {[type]}          [description]
   */
  transpile (filepath) {
    return babel.transform(fs.readFileSync(filepath).toString(), {
      presets: ['env']
    })
  }

  /**
   * Minify JS code using UglifyJS.
   * @param  {string} code
   * This can be raw code or an input file.
   * @return {[type]}      [description]
   */
  minify (code) {
    try {
      code = fs.readFileSync(code).toString()
    } catch (e) {}

    return minifier.minify(code, {
      mangle: true,
      compress: true
    })
  }

  /**
   * Apply text as a header to a file. This injects a comment at the top of
   * the file, based on the content supplied to #header.
   * @param  {String} code
   * The code/content to inject the header above.
   * @param  {String} [type='js']
   * The type of file. Supported values include `js`, `css`, and `html`.
   * @return {String}
   * Returns the code with the header content applied.
   */
  applyHeader (code, type = 'js') {
    if (!this.HEADER) {
      return code
    }

    let msg = this.HEADER.split('\n')

    switch (type.trim().toLowerCase()) {
      case 'html':
        return '<!--\n' + msg.join('\n') + '\n-->\n' + code

      case 'css':
      case 'js':
        if (msg.length === 1) {
          return `// ${msg[0]}\n${code}`
        }

        return '/**\n' + msg.map(line => ` * ${line}`).join('\n') + '\n */\n' + code
    }
  }

  /**
   * Apply text as a header to a file. This injects a comment at the top of
   * the file, based on the content supplied to #footer.
   * @param  {String} code
   * The code/content to inject the footer below.
   * @param  {String} [type='js']
   * The type of file. Supported values include `js`, `css`, and `html`.
   * @return {String}
   * Returns the code with the header content applied.
   */
  applyFooter (code, type = 'js') {
    if (!this.FOOTER) {
      return code
    }

    let msg = this.FOOTER.split('\n')

    switch (type.trim().toLowerCase()) {
      case 'html':
        return code + '\n<!--\n' + msg.join('\n') + '\n-->\n'

      case 'css':
      case 'js':
        if (msg.length === 1) {
          return `${code}\n// ${msg[0]}\n`
        }

        return code + '\n/**\n' + msg.map(line => ` * ${line}`).join('\n') + '\n */\n'
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
   * Clean the output directory. This guarantees the output directory exists
   * and is empty.
   */
  clean () {
    this.tasks.add(`Cleaning ${this.OUTPUT}`, next => fs.emptyDir(this.OUTPUT, next))
  }

  /**
   * A standard build process. Most build processes will override/extend this,
   * but this will add the following tasks to the process:
   *
   * 1. Clean the output directory.
   * 1. Copy #assets from the #source to #output directory.
   * 1. Build HTML (or just copy if minification isn't configured).
   * 1. Transpile JS using Babel.
   * 1. Minify JS using Uglify.
   * 1. Minify CSS.
   * @param  {Boolean} [clean=true]
   *
   */
  build (clean = true) {
    if (clean) {
      this.clean()
    }

    this.tasks.add('Copy Assets', next => {
      let assetTasks = new TaskRunner()

      this.ASSETS.forEach(assetPath => {
        assetTasks.add(`Copying ${assetPath} to output.`, cont => {
          this.copyToOutput(assetPath, cont)
        })
      })

      assetTasks.on('complete', next)
      assetTasks.run()
    })

    this.tasks.add('Build HTML', next => {
      this.walk(path.join(this.SOURCE, '/**/*.htm')).forEach(filepath => {
        fs.copySync(filepath, this.outputDirectory(filepath))
      })

      next()
    })

    this.tasks.add('Build JavaScript', next => {
      let transpiler = new TaskRunner()

      this.walk(path.join(this.SOURCE, '/**/*.js')).forEach(filepath => {
        transpiler.add(`Transpile ${this.localDirectory(filepath)}`, cont => {
          let transpiled = this.transpile(filepath)
          let minified = this.minify(transpiled.code)
          // console.log(transpiled.map)
          // console.log(transpiled.ast)
          let content = this.applyHeader(minified.code, 'js')

          this.writeFile(this.outputDirectory(filepath), content, cont)
        })
      })

      transpiler.on('complete', next)
      transpiler.run()
    })

    this.tasks.add('Build CSS', next => {
      let cssTasks = new TaskRunner()

      this.walk(path.join(this.SOURCE, '/**/*.css')).forEach(filepath => {
        cssTasks.add(`Minify ${this.localDirectory(filepath)}`, cont => {
          let minified = new CleanCSS().minify(fs.readFileSync(filepath).toString())
          let content = this.applyHeader(minified.styles, 'js')
          this.writeFile(this.outputDirectory(filepath), content, cont)
        })
      })

      cssTasks.on('complete', next)
      cssTasks.run()
    })
  }

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
  run (sequential = true) {
    this.tasks.on('stepstarted', step => {
      let ui = new table()

      ui.div({
        text: step.number - 1,
        width: 3,
        padding: [0, 0, 0, 2]
      }, {
        text: ')',
        width: 2
      }, {
        text: this.COLORS.log(`${step.name}`)
      })

      console.log(ui.toString())
    })

    this.tasks.on('complete', () => {
      let ui = new table()

      ui.div({
        text: this.COLORS.log('Complete.'),
        padding: [1, 2, 1, 2],
      })

      console.log(ui.toString())
    })
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
   */
  watch (callback) {
    return require('chokidar').watch(path.join(this.SOURCE, '**/*'), {
      ignored: this.IGNOREDLIST
    })
    .on('add', filepath => callback('create', filepath))
    .on('change', filepath => callback('update', filepath))
    .on('unlink', filepath => callback('delete', filepath))
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
