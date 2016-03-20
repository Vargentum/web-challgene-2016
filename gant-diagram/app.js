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

  Utils.$$ = function(collection) {
    return Array.prototype.slice.call(collection)
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

  function getLowest(d1, d2) {
    return dateToInt(d1) < dateToInt(d2) ? d1 : d2
  }
  function getLargest(d1, d2) {
    return dateToInt(d1) > dateToInt(d2) ? d1 : d2
  }


  function getTotalTasksTiming (data) {
    return data.reduce(function(p, n) {
      return {
        start_date: getLowest(n.start_date, p.start_date),
        end_date:   getLargest(n.end_date, p.end_date)
      }
    })
  }

  function createTimingPanel(data, scale) {
    var timing = getTotalTasksTiming(data)
    var panel = []
    for (var i = dateToInt(timing.start_date);
             i <= dateToInt(timing.end_date);
             i += SCALE_TYPES[scale]) {
      (function(i) {
        panel.push(new Date(i))
      })(i)
    }
    return panel
  }

  function buildRow(data, scale, initField, forEachTimezone) {
    let row = [initField].concat(createTimingPanel(data, scale))
    row.forEach(forEachTimezone)
  }

  function makeDiagramFrom(data, scale) {
    var table = document.createElement('table')
    var head = table.createTHead()
    var tasks = flattenTasks(data)
    tasks.forEach(function(entry) {
      console.log(entry)
      var bodyRow = table.insertRow()
      var cell = bodyRow.insertCell()
      cell.innerText('1')
      // buildRow(data, scale, entry.text, function(date, idx) {
      //   var cell = bodyRow.insertCell()
      //   if (idx === 0) {
      //     cell.innerText = date
      //   }
      //   else if(
      //     dateToInt(date) >= dateToInt(entry.start_date) &&
      //     dateToInt(date) <= dateToInt(entry.end_date)
      //   ) {
      //     cell.classList.add('is-active')
      //   }
      // })
    })
    // var headRow = head.insertRow()
    // buildRow(data, scale, 'name', function(date) {
    //   var cell = headRow.insertCell()
    //   cell.innerText = date
    // })
    return table
  }


  function flattenTasks(data) {
    return Object.keys(data).reduce(function(p, key) {
      var t = data[key]
      if (!t.Tasks) return p
      if (!t.Tasks.Task.length) return p.concat([n])
      return t.Tasks.Task.map(flattenTasks)
    }, [])
  }



  function ChartBuilder(data, config) {
    this.config = config
    this.config.scale = config.scale || DEFAULT_SCALE_TYPE
    this.data = data
    this.chart = makeDiagramFrom(this.data, this.config.scale)
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
    var tasks = []
    if (data.Tasks) {
      Array.isArray(data.Tasks.Task)
        ? tasks = data.Tasks.Task
        : tasks = [data.Tasks.Task]
    }
    tasks.forEach(function(task) {
      var item = document.createElement('li')
      item.innerText = task.Name
      if (task.Tasks) item.appendChild(r_tasks(task))
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

  function initModules(k) {
    this.config.elem.appendChild(this.modules[k])
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





