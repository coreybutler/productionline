# productionline

`npm install productionline --save-dev`

An extendable class for creating builds (transpilation, minification, concatenation, etc).

While gulp and grunt are mature tools with a large ecosystem, some build processes simply don't warrant the complexity. Furthermore, a _global executable_ doesn't _have_ to be a requirement for a build pipeline when Node/npm itself is a) suitable for the task and b) already installed. We prefer to configure npm scripts, executed as `npm run build`. This module provides an extendable JS Class that provides a simple structure for running any kind of build pipeline.

## Examples

See the examples, and feel free to submit PR's with new examples.

## Basic Use

The source code is well documented.

```js
const ProductionLine = require('productionline')
const builder = new ProductionLine()

switch (process.argv[2]) {
  case '--build':
    console.log('Running Build Process:')

    // The following are not explicitly necessary since the source,
    // assets, and destination are all being set to their defaults.
    // However; the code is written so you can supply your own
    // folder structure.
    builder.source = path.resolve('./src')
    builder.assets = path.resolve('./assets') // Relative to source!
    builder.destination = path.resolve('./dist')

    // Queue the built-in build process.
    builder.build()
    break

  default:
    return console.log('No command specified!')
}

builder.run()
```

## Extending the Production Line

This is the most anticipated use case, since most build processes are unique in some manner.

Basic ES 2016 class extension is the easiest way to use this library. The builder merely queues tasks using an internal  [shortbus](https://github.com/coreybutler/shortbus) instance, accessible via `this.tasks`.

```js
 const ProductionLine = require('productionline')

 class CustomBuilder extends ProductionLine {
   constructor {
     super()
   }

   build () {
     this.info('I extend the original build method!')
     super.build()
   }

   buildDebug () {
     this.tasks.add('Custom Step 1', next => { ... })
     this.tasks.add('Custom Step 2', next => { ... })
     this.tasks.add('Custom Step 3', next => { ... })
   }
 }

 switch (process.argv[2]) {
   case '--build':
     console.log('Running Build Process:')

     // Queue the built-in build process.
     builder.build()
     break

   case '--debug':
     console.log('Running Building Process:')

     // Queue the built-in build process.
     builder.build()
     break

   default:
     return console.log('No command specified!')
 }

 builder.run() // This executes all of the tasks
 ```
