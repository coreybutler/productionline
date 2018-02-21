'use strict'

const ProductionLine = require('../')
const test = require('tape')

test('Sanity Test', function (t) {
  t.ok(typeof ProductionLine === 'function', 'Class is recognized by Node.')
  t.end()
})

test('Basic Build', function (t) {
  let builder = new ProductionLine()
  let ct = 0

  builder.customStep('Step A', () => ct++)
  builder.customStep('Step B', () => ct++)
  builder.customStep('Step C', next => setTimeout(() => {
    ct++
    next()
  }, 600))

  builder.on('complete', () => {
    t.ok(ct === 3, 'All steps processed successfully.')
    t.end()
  })

  builder.run()
})
