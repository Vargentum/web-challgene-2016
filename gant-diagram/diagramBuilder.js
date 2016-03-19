'use strict';

var DiagramBuilder = (function () {
  var datePattern = /\d{4}\-\d{2}\-\d{2}/
  var SCALE_TYPES = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  }
  var DEFAULT_SCALE_TYPE = 'day'

  function objectAssign() {
    var args = Array.prototype.slice.call(arguments)
    var restlt = {}

    return args.reduce(function(prev, next) {
      return Object.keys(next).reduce(function(p, k) {
        p[k] = next[k]
        console.log(p)
        return p
      }, prev)
    }, {})

  }

  function makeRequest(file, onsuccess) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', file)
    xhr.send()
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return //loading handling
      if (xhr.status !== 200) return //error handling
      onsuccess(JSON.parse(xhr.responseText))
    }
  }

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

  function buildRow(data, scale, initField, cb) {
    let row = [initField].concat(createTimingPanel(data, scale))
    row.forEach(cb)
  }

  function makeDiagramFrom(data, scale) {
    var table = document.createElement('table')
    var head = table.createTHead()

    data.forEach(function(entry) {
      var bodyRow = table.insertRow()
      buildRow(data, scale, entry.text, function(date, idx) {
        var cell = bodyRow.insertCell()
        if (idx === 0) {
          cell.innerText = date
        } 
        else if(
          dateToInt(date) >= dateToInt(entry.start_date) && 
          dateToInt(date) <= dateToInt(entry.end_date)
        ) {
          cell.classList.add('is-active')
        }
      })
    })
    var headRow = head.insertRow()
    buildRow(data, scale, 'name', function(date) {
      var cell = headRow.insertCell()
      cell.innerText = date
    })
    return table
  }


  function DiagramBuilder(config) {
    this.config = config
    this.config.scale = config.scale || DEFAULT_SCALE_TYPE
  }

  DiagramBuilder.prototype.init = function(){
    var handleUpdate = function(data) {
      this.config.elem.innerHTML = ""
      this.config.elem.appendChild(makeDiagramFrom(data, this.config.scale))
    }
    makeRequest(this.config.file, handleUpdate.bind(this))
  };

  DiagramBuilder.prototype.update = function(newConfig){
    this.config = objectAssign(this.config, newConfig)
    this.init(this.config) 
  }

  return DiagramBuilder
})()