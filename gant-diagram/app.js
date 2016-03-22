'use strict';

var TaskModel = {
  Duration: 'number',
  Id: 'string',
  Name: 'string',
  PersentDone: 'number',
  StartDate: 'date',
  Tasks: 'array',
  expanded: 'bool'
}



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

  Utils.$ = function(query) {
    return Array.prototype.slice.call(document.querySelectorAll(query))
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
  var DEFAULT_SCALE_TYPE = 'day'

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
      cell.innerText = tmz.toDateString()
    })
  }

  function buildBody(tasks, startDates, durations, table, min, max, scale) {
    tasks.forEach(function(entry, i) {
      var bodyRow = table.insertRow()
      var startDate = dateToInt(startDates[i])
      var endDate = startDate + durToInt(durations[i])

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
    this.config.scale = config.scale || DEFAULT_SCALE_TYPE
    this.data = updateDurations(data)
    this.chart = buildChartTable(this.data, this.config.scale)
  }

  ChartBuilder.prototype.mountTo = function(point){
    Utils.$$(point.children).forEach(function(c) {
      point.removeChild(c)
    })
    point.appendChild(this.chart)
  };

  return ChartBuilder
})()



/*------------------------------------------------
  GroupsBuilder
------------------------------------------------*/
var GroupsBuilder = (function () {

  function r_tasks(data) {
    var list = document.createElement('ul')

    data.forEach(function(task) {
      var item = document.createElement('li')
      item.innerText = task.Name
      if (task.Tasks && task.Tasks.length) {
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
    }
    getData(this.config.file, initComponents.bind(this))
  }

  App.prototype.update = function(newConfig) {
    this.config = Utils.objectAssign(this.config, newConfig)
    this.init()
  }

  return App
})()





