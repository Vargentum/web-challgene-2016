'use strict';


var Utils = (function() {

  var Utils = {}

  Utils.objectAssign = function objectAssign() {
    var args = Array.prototype.slice.call(arguments)

    return args.reduce(function(prev, next) {
      return Object.keys(next).reduce(function(p, k) {
        p[k] = next[k]
        return p
      }, prev)
    }, {})
  }

  Utils.template = function(str, data) {
    Object.keys(data).forEach(function(key) {
      str = str.replace(new RegExp("\\${"+key+"}", 'g'), data[key])
    })
    return str
  }

  Utils.$ = function(query, elem) {
    return Array.prototype.slice.call((elem || document).querySelectorAll(query))
  }

  Utils.$$ = function(collection) {
    return Array.prototype.slice.call(collection)
  }

  Utils.flattenContains = function flattenContains(data, prop) {
    var res = []
    data.forEach(function flat(d){
      res.push(d)
      if (d[prop] && d[prop].length) {
        d[prop].forEach(flat)
      }
    })
    return res
  }

  Utils.pluck = function pluck(data, prop) {
    return data
      .filter(function(entry) {
        return entry[prop]
      })
      .map(function(entry) {
        return entry[prop]
      })
  }

  Utils.mount = function mount(node, point){
    Utils.$$(point.children).forEach(function(chld) {
      point.removeChild(chld)
    })
    point.appendChild(node) 
  }

  Utils.unmount = function unmount(node, point) {
    if (node.parentElement !== point) return
    point.removeChild(node)
  }


  return Utils
})()




/*------------------------------------------
  Error module
------------------------------------------*/
var ErrorArea = (function() {
  function render(data) {
    return Utils.template("<div><h2>${name}</h2><p>${message}</p></div>", data)
  }
  
  function ErrorArea(name, message) {
    this.node = document.createElement('div')
    this.node.innerHTML = render({
      name: name,
      message: message
    })
  }

  return ErrorArea
})()


/*-------------------------------------------
ChartBuilder
-------------------------------------------*/
var ChartBuilder = (function () {

  var SCALE_TYPES = {
    hour: 60 * 60 * 1000
  }
  SCALE_TYPES.day =   24 * SCALE_TYPES.hour
  SCALE_TYPES.week =   7 * SCALE_TYPES.day
  SCALE_TYPES.month = 30 * SCALE_TYPES.week

  var DATA_INDEXES = {
    hour:  [0, 2],
    day:   [2,1],
    week:  [2,3],
    month: [1,3]
  }
  // "Mon Jan 18 2010"

  function dateToInt (s) { return new Date(s).getTime()}
  function durToInt (d) { return parseInt(d) * SCALE_TYPES['day']}

  function getEarliest (startDates) {
    return startDates
      .map(dateToInt)
      .sort(function(d1, d2) {
        return d1 - d2
      })[0]
  }

  function getLatest (startDates, durations) {
    return startDates
      .map(function(d, i) {
        return dateToInt(d) + durToInt(durations[i])
      })
      .sort(function(d1, d2) {
        return d2 - d1
      })[0]
  }

  function createTimingPanel(min, max, scale) {
    var panel = []
    for (var i = min; i <= max; i += SCALE_TYPES[scale]) {
      (function(i) {
        panel.push(new Date(i))
      })(i)
    }
    return panel
  }

  function buildRow(min, max, scale, forEachTimezone) {
    createTimingPanel(min, max, scale).forEach(forEachTimezone)
  }

  function buildHead(table, min, max, scale) {
    var headRow = table.createTHead().insertRow()
    buildRow(min, max, scale, function(tmz) {
      var cell = headRow.insertCell()
      cell.innerText = (function(timeArr) {
        return (function(idxToGet) {
          return idxToGet.reduce(function(p, n) { return p + ' ' + timeArr[n] }, '')
        })(DATA_INDEXES[scale])
      })(tmz.toDateString().split(' '))
    })
  }

  function buildBody(tasks, startDates, durations, table, min, max, scale) {
    tasks.forEach(function(entry, i) {
      var bodyRow = table.insertRow()
      var startDate = dateToInt(startDates[i])
      var endDate = startDate + durToInt(durations[i])

      bodyRow.setAttribute('data-task-id', i)
      buildRow(min, max, scale, function(tmz) {
        var cell = bodyRow.insertCell()
        if (startDate <= dateToInt(tmz) && dateToInt(tmz) <= endDate) {
          if (startDate !== endDate) {
            cell.classList.add('is-active')
          }
        }
      })
    })
  }

  function buildChartTable(data, scale) {
    var table = document.createElement('table')
    var tasks = Utils.flattenContains(data, 'Tasks')
    var startDates = Utils.pluck(tasks, 'StartDate')
    var durations = Utils.pluck(tasks, 'Duration')
    var min = getEarliest(startDates)
    var max = getLatest(startDates, durations)

    buildBody(
      tasks,
      Utils.pluck(tasks, 'StartDate'),
      Utils.pluck(tasks, 'Duration'),
      table, min, max, scale
    )
    buildHead(table, min, max, scale)
    return table
  }


  function getChildrenDuration(arr) {
    return arr.reduce(function(p, n) {
      return n.Tasks && n.Tasks.length
        ? p + getChildrenDuration(n.Tasks)
        : p + parseInt(n.Duration)
    }, 0)
  }


  function updateDurations(arr) {
    return arr.map(function(entry) {
      if (entry.Tasks && entry.Tasks.length) {
        entry.Duration = getChildrenDuration(entry.Tasks)
        updateDurations(entry.Tasks)
      }
      return entry
    })
  }


  function ChartBuilder(data, config) {
    this.config = config
    this.config.scale = config.scale
    this.data = updateDurations(data)
    this.chart = buildChartTable(this.data, this.config.scale)
  }

  ChartBuilder.prototype.processSelectedRows = function(startIdx, endIdx, callback) {
    Utils.$$(this.chart.tBodies[0].rows)
      .filter(function(r, rIdx) {return startIdx <= rIdx && rIdx <= endIdx})
      .forEach(callback)
  }

  return ChartBuilder
})()



/*------------------------------------------------
  GroupsBuilder
------------------------------------------------*/
var GroupsBuilder = (function () {

  function getTL(data) {
    return data.reduce(function(p, task) {
      if (task.Tasks && task.Tasks.length) {
        return p += getTL(task.Tasks) + 1
      }
      return p + 1
    }, 0)
  }

  function r_tasks(data) {
    var tId = 0

    return (function dataToTasks(data) {
      var list = document.createElement('ul')

      data.forEach(function(task) {
        var item = document.createElement('li')
        item.innerText = task.Name
        item.setAttribute('data-task-id', tId++)

        if (task.Tasks && task.Tasks.length) {
          item.classList.add('is-expanded')
          item.appendChild(dataToTasks(task.Tasks))
          item.setAttribute('data-tasks-length', getTL(task.Tasks))
        }
        list.appendChild(item)
      })
      return list
    })(data)
  }


  function GroupsBuilder(data, config) {
    this.data = data
    this.config = config
    this.list = r_tasks(this.data)
  }

  return GroupsBuilder
})()





/*------------------------------------------
  App
------------------------------------------*/
var App = (function () {

  function getData(file, onsuccess, onerror) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', file)
    xhr.send()
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return //loading handling
      if (xhr.status !== 200) {
        onerror(xhr.status, xhr.statusText)
      }
      else {
        onsuccess(JSON.parse(xhr.responseText))
      }
    }
  }

  function initModules(name) {
    this.modules[name].classList.add(name)
    this.config.elem.appendChild(this.modules[name])
  }

  function processLinkedRowsAndGroups(e, validTarget, rHandler, gHandler) {
    var t = e.target
    if (!validTarget(t)) return
    var startIdx = parseInt(t.getAttribute('data-task-id'))
    var endIdx =   parseInt(t.getAttribute('data-tasks-length')) + startIdx

    this.ChartBuilder.processSelectedRows(
      startIdx,
      endIdx || startIdx, //TODO: make more clearly
      rHandler.bind(this)
    )
    gHandler.call(this, t)
  }

  function clickHandler(e) {
    processLinkedRowsAndGroups.call(
      this,
      e,
      function(t) {
        return (t.tagName === 'LI' && t.hasAttribute('data-task-id') && t.hasAttribute('data-tasks-length'))
      },
      function(row, i) {
        if (i === 0) return 
        row.classList.toggle('is-hidden')
      },
      function(t) {
        Utils.$('ul', t).forEach(function(list) {
          list.classList.toggle('is-hidden')
          if (list.classList.contains('is-hidden')) {
            list.parentElement.classList.add('is-collapsed')
            list.parentElement.classList.remove('is-expanded')
          }
          else {
            list.parentElement.classList.remove('is-collapsed')
            list.parentElement.classList.add('is-expanded')
          }
        })
      }
    )
  }

  function mouseOverHandler(e) {
    processLinkedRowsAndGroups.call(
      this,
      e,
      function(t) {
        return (t.tagName === 'LI' && t.hasAttribute('data-task-id'))
      },
      function(row) {
        row.classList.add('is-highlighted')
      },
      function(t) {
        t.classList.add('is-highlighted')
      }
    )
  }

  function mouseOutHandler(e) {
    processLinkedRowsAndGroups.call(
      this,
      e,
      function(t) {
        return (t.tagName === 'LI' && t.hasAttribute('data-task-id'))
      },
      function(row) {
        row.classList.remove('is-highlighted')
      },
      function(t) {
        t.classList.remove('is-highlighted')
      }
    )
  }

  var AppListeners = {
    click: clickHandler,
    mouseover: mouseOverHandler,
    mouseout: mouseOutHandler
  }

  function listnersController (method) {
    Object.keys(AppListeners).forEach(function (type) {
      this.config.elem[method](type, AppListeners[type].bind(this))
    }, this)
  }

  function onDataSuccess(data) {
    this.GroupsBuilder = new GroupsBuilder(data, this.config)
    this.ChartBuilder = new ChartBuilder(data, this.config)
    Utils.mount(this.GroupsBuilder.list, this.modules.groups)
    Utils.mount(this.ChartBuilder.chart, this.modules.chart)

    if (this.ErrorArea) {
      Utils.unmount(this.ErrorArea.node, this.modules.error)
    }
  }

  function onDataFail(status, message) {
    this.ErrorArea = new ErrorArea(status, message, this.config)
    Utils.unmount(this.GroupsBuilder.list, this.modules.groups)
    Utils.unmount(this.ChartBuilder.chart, this.modules.chart)
    Utils.mount(this.ErrorArea.node, this.modules.error)
  }

  function App (config) {
    this.config = config
    this.modules = {
      groups: document.createElement('div'),
      chart: document.createElement('div'),
      error: document.createElement('div')
    }
    Object.keys(this.modules).forEach(initModules.bind(this))
    listnersController.call(this, 'addEventListener')
    this.init()
  }

  App.prototype.init = function() {
    getData(
      this.config.file,
      onDataSuccess.bind(this),
      onDataFail.bind(this)
    )
  }

  App.prototype.update = function(newConfig) {
    this.config = Utils.objectAssign(this.config, newConfig)
    this.init()
  }

  return App
})()





