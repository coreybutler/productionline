# productionline [![Build Status](https://travis-ci.org/coreybutler/productionline.svg?branch=master)](https://travis-ci.org/coreybutler/productionline)

`npm install productionline --save-dev`

An extendable queuing system for creating build pipelines (transpilation, minification, concatenation, etc).

While gulp and grunt are mature tools with a large ecosystem, some build processes simply don't warrant the complexity. Plus, as awesome as streams are, it's typically easier for most developers think of build processes in sequential steps than stream manipulations. Furthermore, a _global executable_ doesn't _have_ to be a requirement for a build pipeline when Node/npm itself is a) suitable for the task and b) already installed. We prefer to configure npm scripts, executed as `npm run build`. This module provides an extendable JS Class, serving as a baseline for running any kind of build pipeline.

## Examples

See the examples, and feel free to submit PR's with new examples.

## Basic Use

The source code is well documented with several feature methods.

The following would go in a file called `build.js`.

```js
const ProductionLine = require('productionline')
const builder = new ProductionLine({
  commands: {
    default: function (cmd) {
      console.log('No command specified!')
    },

    '--buildme': function (cmd) {
      console.log('Running Build Process:')

      // The following are not explicitly necessary since the source,
      // assets, and destination are all being set to their defaults.
      // However; the code is written so you can supply your own
      // folder structure.
      builder.source = path.resolve('./src')
      builder.assets = path.resolve('./assets') // Relative to source!
      builder.destination = path.resolve('./dist')

      // Queue the built-in make process.
      builder.addTask('My Build Task', function (next) {
        // Do something
        next()
      })

      builder.run()
    }
  }
})
```

In the `package.json` file, add an npm command like:

```js
{
  "scripts": {
    "test": "...",
    "build": "node build.js --buildme"
  }
}
```

The entire process can then be run using `npm run build`.

## Extending the Production Line

This is the most anticipated use case, since most build processes are unique in some manner.

Basic ES 2016 class extension is the easiest way to create a custom build tool. The builder queues tasks using an internal  [shortbus](https://github.com/coreybutler/shortbus) instance, accessible via `this.tasks`. Once all tasks are queued, the build process can be run.

```js
 const ProductionLine = require('productionline')

 class CustomBuilder extends ProductionLine {
   constructor {
     super()
   }

   make () {
     this.addStep('Custom step', (next) => {
       // Do something
       // ...

       // When complete, run the next queued task.
       next()
     })
   }

   makeDebuggableVersion () {
     this.tasks.add('Custom Step 1', next => {
        someAsynchrnousOperation(() => {
          next()
        })
     })
     this.tasks.add('Custom Step 2', next => { ... })
     this.tasks.add('Custom Step 3', next => { ... })
   }
 }

 const builder = new ProductionLine({
   commands: {
     '--make': () => {
       console.log('Running Build Process:')

       // Queue the built-in make process.
       builder.make()
       builder.run() // This executes all of the queued tasks.
     },

     '--debug': () => {
       console.log('Running Building Process:')

       // Queue the custom debug process.
       builder.makeDebuggableVersion()
       builder.run() // This executes all of the queued tasks.
     },

     default: () => console.log('No command specified!')

   }
 })
 ```

## Live Builds

During development, it's often useful to monitor source code and rebuild whenever a file changes. To support this, productionline contains a `watch`
task, which will remain running and respond to file system changes.

For example:

```js
builder.watch((action, filepath) => {
  builder.run()

  builder.watch((action, filepath) => {
    if (action === 'create') {
      console.log('New file created, rerun the build.')
      builder.run()
    }
  })
})
```
