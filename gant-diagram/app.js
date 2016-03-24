'use strict';


var Utils = (function() {

  var Utils = {}

  Utils.objectAssign = function objectAssign() {
    var args = Array.prototype.slice.call(arguments)
    var restlt = {}

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


  return Utils
})()



/*-------------------------------------------
ChartBuilder
-------------------------------------------*/
var ChartBuilder = (function () {

  var SCALE_TYPES = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  }
  var DATA_INDEXES = {
    hour: [0, 2],
    day:  [2,1],
    week: [2,3],
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

  ChartBuilder.prototype.mountTo = function(point){
    Utils.$$(point.children).forEach(function(c) {
      point.removeChild(c)
    })
    point.appendChild(this.chart)
  };

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
  var taskId = 0
  var groupId = 0 //TODO: bind inside function (cause to error)

  function r_tasks(data) {
    var list = document.createElement('ul')

    data.forEach(function(task, i) {
      var item = document.createElement('li')
      item.innerText = task.Name
      item.setAttribute('data-task-id', taskId++)

      if (task.Tasks && task.Tasks.length) {
        item.setAttribute('data-tasks-length', task.Tasks.length)
        item.appendChild(r_tasks(task.Tasks))
      }
      list.appendChild(item)
    })
    return list
  }


  function GroupsBuilder(data, config) {
    this.data = data
    this.config = config
    this.list = r_tasks(this.data)
  }

  GroupsBuilder.prototype.mountTo = function mountTo(point) {
    Utils.$$(point.children).forEach(function(c) {
      point.removeChild(c)
    })
    point.appendChild(this.list)
  }

  GroupsBuilder.prototype.processSubTasks = function processSubTasks(elem, cb) {
    Utils.$('ul', elem).forEach(cb)
  }

  return GroupsBuilder
})()





/*------------------------------------------
  App
------------------------------------------*/
var App = (function () {

  function getData(file, onsuccess) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', file)
    xhr.send()
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return //loading handling
      if (xhr.status !== 200) return //error handling
      onsuccess(JSON.parse(xhr.responseText))
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
      endIdx,
      rHandler
    )
    this.GroupsBuilder.processSubTasks(t, gHandler)
  }

  function clickHandler(e) {
    processLinkedRowsAndGroups.call(
      this,
      e, 
      function(t) {
        return (t.tagName === 'LI' && t.hasAttribute('data-task-id') && t.hasAttribute('data-tasks-length'))
      },
      function(row) {
        row.classList.toggle('is-hidden')
      },
      function(list, i, parent) {
        parent[0].classList.toggle('is-expanded')
        list.classList.toggle('is-hidden')
      }
    )
  }

  function mouseEnterHandler(e) {
    processLinkedRowsAndGroups.call(
      this,
      e,
      function(t) {
        return (t.tagName === 'LI' && t.hasAttribute('data-task-id'))
      },
      function(row) {
        row.classList.add('is-highlighted')
      },
      function(list, i, parent) {
        list.classList.add('is-highlighted')
      }
    )
  } 
  
  function mouseLeaveHandler(e) {
    processLinkedRowsAndGroups.call(
      this,
      e,
      function(t) {
        return (t.tagName === 'LI' && t.hasAttribute('data-task-id'))
      },
      function(row) {
        row.classList.remove('is-highlighted')
      },
      function(list, i, parent) {
        list.classList.remove('is-highlighted')
      }
    )
  } 


  function App (config) {
    this.config = config
    this.modules = {
      groups: document.createElement('div'),
      chart: document.createElement('div')
    }
    Object.keys(this.modules).forEach(initModules.bind(this))
    this.init()
  }

  App.prototype.init = function() {
    function initComponents(data) {
      this.GroupsBuilder = new GroupsBuilder(data, this.config)
      this.ChartBuilder = new ChartBuilder(data, this.config)
      this.GroupsBuilder.mountTo(this.modules.groups)
      this.ChartBuilder.mountTo(this.modules.chart)
      this.config.elem.addEventListener('click', clickHandler.bind(this))
      this.config.elem.addEventListener('mouseover', mouseEnterHandler.bind(this))
      this.config.elem.addEventListener('mouseout', mouseLeaveHandler.bind(this))
    }
    getData(this.config.file, initComponents.bind(this))
  }

  App.prototype.update = function(newConfig) {
    this.config = Utils.objectAssign(this.config, newConfig)
    this.init()
  }

  return App
})()





