const TaskRunner = require('shortbus')
const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')
const babel = require('babel-core')
const minifier = require('uglify-js')
const CleanCSS = require('clean-css')
const chalk = require('chalk')

class Builder {
  constructor () {
    this.tasks = new TaskRunner()

    const pkg = require(path.join(process.cwd(), 'package.json'))

    // Metadata
    this.APPVERSION = pkg.version
    this.HEADER = `Copyright (c) ${(new Date()).getFullYear()} ${pkg.author}. All Rights Reserved.\nVersion ${pkg.version} built on ${new Date().toDateString()}.`
    this.FOOTER = null

    // Filepaths
    this.SOURCE = path.resolve('./src')
    this.OUTPUT = path.resolve('./dist')
    this.ASSETS = [
      './assets'
    ]

    this.joinArguments = args => {
      let out = []

      for (let i = 0; i < args.length; i++) {
        out.push(args[i])
      }

      return out.join(' ')
    }
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

  set source (value) {
    this.SOURCE = value
  }

  set destination (value) {
    this.OUTPUT = value
  }

  set assets (value) {
    this.ASSETS = value
  }

  /**
   * Retrieves all files (recursively) within a directory.
   * Supports glob patterns.
   * @param  {string} directory
   * The directory to walk.
   * @return {Array}
   * An array containing the absolute path of each file in the directory.
   */
  walk (directory) {
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
        ignore: [
          'node_modules/**/*'
        ]
      })
    }

    // Walk the directory without globbing
    let files = []

    fs.readdirSync(directory).forEach(dir => {
      if (fs.statSync(dir).isDirectory()) {
        files = files.concat(this.walk(path.join(directory, dir)))
      } else {
        files.push(path.join(directory, dir))
      }
    })

    return files
  }

  /**
   * Create the same path in the output directory as the input directory.
   * @param  {string} inputFilepath
   * The path to mimic in the output directory.
   * @return {string}
   * The corresponding output path.
   */
  output (inputFilepath) {
    return inputFilepath.replace(this.SOURCE, this.OUTPUT)
  }

  /**
   * Opposite of the output() method.
   * @param  {string} outputFilepath
   * The output path to mimic in the source/input directory.
   * @return {string}
   * The corresponding input path.
   */
  local (outFilepath) {
    return outFilepath.replace(this.SOURCE, '').replace(this.OUTPUT, '')
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
    let outputPath = this.output(sourcePath)

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
        fs.copySync(filepath, this.output(filepath))
      })

      next()
    })

    this.tasks.add('Build JavaScript', next => {
      let transpiler = new TaskRunner()

      this.walk(path.join(this.SOURCE, '/**/*.js')).forEach(filepath => {
        transpiler.add(`Transpile ${this.local(filepath)}`, cont => {
          let transpiled = this.transpile(filepath)
          let minified = this.minify(transpiled.code)
          // console.log(transpiled.map)
          // console.log(transpiled.ast)
          let content = this.applyHeader(minified.code, 'js')

          this.writeFile(this.output(filepath), content, cont)
        })
      })

      transpiler.on('complete', next)
      transpiler.run()
    })

    this.tasks.add('Build CSS', next => {
      let cssTasks = new TaskRunner()

      this.walk(path.join(this.SOURCE, '/**/*.css')).forEach(filepath => {
        cssTasks.add(`Minify ${this.local(filepath)}`, cont => {
          let minified = new CleanCSS().minify(fs.readFileSync(filepath).toString())
          let content = this.applyHeader(minified.styles, 'js')
          this.writeFile(this.output(filepath), content, cont)
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
    this.tasks.on('stepcomplete', step => this.log(`  ${step.number}) ${step.name} completed.`))
    this.tasks.on('complete', () => this.success('\n  === DONE ===\n'))
    this.tasks.run(sequential)
  }

  /**
   * A special color-coded (red) console logger. Behaves the same as `console.log`
   */
  failure () {
    console.log(chalk.bold.rgb(214, 48, 49)(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (orange) console logger. Behaves the same as `console.log`
   */
  warn () {
    console.log(chalk.bold.rgb(225, 112, 85)(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (light blue) console logger. Behaves the same as `console.log`
   */
  info () {
    console.log(chalk.bold.rgb(116, 185, 255)(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (almost white) console logger. Behaves the same as `console.log`
   */
  log () {
    console.log(chalk.bold.rgb(223, 230, 233)(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (bright pink) console logger. Behaves the same as `console.log`
   */
  highlight () {
    console.log(chalk.bold.rgb(232, 67, 147)(this.joinArguments(arguments)))
  }

  /**
   * A special color-coded (tea green) console logger. Behaves the same as `console.log`
   */
  success () {
    console.log(chalk.bold.rgb(85, 239, 196)(this.joinArguments(arguments)))
  }
}

module.exports = Builder
