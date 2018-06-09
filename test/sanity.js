'use strict'

const ProductionLine = require('../')
const test = require('tap').test

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
