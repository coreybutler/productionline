'use strict'

const ProductionLine = require('../')
const test = require('tap').test
const path = require('path')
const fs = require('fs')

const tmpSrc = path.join(__dirname, 'tmp_project')

const rmdir = dir => {
  try {
    let list = fs.readdirSync(dir)

    for (let i = 0; i < list.length; i++) {
      let filename = path.join(dir, list[i])
      let stat = fs.statSync(filename)

      if (!(filename === '.' && filename === '..')) {
        if (stat.isDirectory()) {
          rmdir(filename)
        } else {
          fs.unlinkSync(filename)
        }
      }
    }

    fs.rmdirSync(dir)
  } catch (e) {
    if (e.message.indexOf('no such') < 0) {
      console.error(e)
    }
  }
}

const exitHandler = () => {
  rmdir(tmpSrc)
}

test('Sanity Test', function (t) {
  t.ok(typeof ProductionLine === 'function', 'Builder Class is recognized by Node.')
  // t.ok(typeof ProductionLine.Monitor === 'function', 'Monitor Class is recognized by Node.')
  // t.ok(typeof ProductionLine.TaskRunner === 'function', 'TaskRunner Class is recognized by Node.')
  t.end()
})

test('Basic Build', function (t) {
  let builder = new ProductionLine()
  let ct = 0

  builder.assets = [] // No assets in the test.
  builder.source = './'
  // console.log(builder.source)

  builder.addTask('Step A', () => ct++)
  builder.addTask('Step B', () => ct++)
  builder.addTask('Step C', next => setTimeout(() => {
    ct++
    next()
  }, 600))

  builder.on('complete', () => {
    t.ok(ct === 3, 'All steps processed successfully.')
    t.end()
  })

  builder.run()
})

test('Basic Extension', function (t) {
  let ct = 0

  class Builder extends ProductionLine {
    before () {
      this.addTask('PreStep 1', () => ct++)
    }

    after () {
      this.addTask('PostStep 1', () => ct++)
    }
  }

  let builder = new Builder()

  builder.addTask('Step A', () => ct++)
  builder.addTask('Step B', () => ct++)
  builder.addTask('Step C', next => setTimeout(() => {
    ct++
    next()
  }, 600))

  builder.on('complete', () => {
    t.ok(ct === 5, 'Before/After steps processed successfully.')
    t.end()
  })

  builder.run()
})

test('Basic Timer', function (t) {
  let builder = new ProductionLine()

  builder.addTask('test', next => setTimeout(next, 2000))

  builder.on('complete', () => {
    t.ok(builder.TIMER.total > 2, 'Timer returns a correct value.')
    t.end()
  })

  builder.run()
})

test('Update Checks', function (t) {
  let builder = new ProductionLine()

  builder.identifyOutdatedModules()

  builder.checkModuleVersion('productionline', (err, version) => {
    t.ok(err === null, 'Retrieved version data from npm.')
    t.end()
  })
})

test('File Monitoring', function (t) {
  rmdir(tmpSrc)
  fs.mkdirSync(tmpSrc)

  let builder = new ProductionLine({ source: tmpSrc })

  fs.mkdirSync(path.join(tmpSrc, 'blah'))
  let testFile = path.join(tmpSrc, 'blah', 'test.js')

  builder.on('watch', () => {
    setTimeout(() => fs.writeFileSync(testFile, 'console.log(\'test\')', 'utf8'), 300)
  })

  builder.watch((action, filename) => {
    switch (action) {
      case 'create':
        t.pass('File creation detected.')
        fs.appendFileSync(testFile, '\n// more')
        break

      case 'update':
        t.pass('File update detected.')
        fs.unlinkSync(testFile)
        break

      case 'delete':
        t.pass('File delete detected.')
        builder.unwatch()
        t.end()
    }
  })
})

process.on('exit', exitHandler)
process.on('SIGINT', exitHandler)
process.on('SIGUSR1', exitHandler)
process.on('SIGUSR2', exitHandler)
process.on('uncaughtException', e => {
  console.log('Uncaught Exception...')
  console.log(e.stack)
  process.exit(99)
})
