'use strict'

const ProductionLine = require('../')
const test = require('tape')

test('Sanity Test', function (t) {
  t.ok(typeof ProductionLine === 'function', 'Builder Class is recognized by Node.')
  // t.ok(typeof ProductionLine.Monitor === 'function', 'Monitor Class is recognized by Node.')
  // t.ok(typeof ProductionLine.TaskRunner === 'function', 'TaskRunner Class is recognized by Node.')
  t.end()
})

test('Basic Build', function (t) {
  let builder = new ProductionLine()
  let ct = 0

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
