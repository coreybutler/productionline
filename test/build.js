const ProductionLine = require('../index')

const builder = new ProductionLine()

builder.before = () => {
  builder.addTask('intentional delay', next => {
    console.log('ok')
    setTimeout(() => next(), 3000)
  })
}

builder.run(true)
