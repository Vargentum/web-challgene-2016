'use strict';

var DiagramBuilder
(function (DiagramBuilder) {
  var datePattern = /\d{4}\-\d{2}\-\d{2}/
  var SCALE_TYPES = {
    hour: 60 * 60 * 100,
    day: 24 * 60 * 60 * 100,
    week: 7 * 24 * 60 * 60 * 100,
    month: 30 * 24 * 60 * 60 * 100,
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
    var scale = 'month'
    var timing = getTotalTasksTiming(data)
    var panel = []
    for (var i = dateToInt(timing.start_date);
             i <= dateToInt(timing.end_date);
             i += SCALE_TYPES[scale]) {
      (function(i) {
        panel.push(new Date(i).toString())
      })(i)
    }
    return panel
  }


  function buildRow(data, initField, cb) {
    let row = [initField].concat(createTimingPanel(data))
    row.forEach(cb)
  }


  function makeDiagramFrom(data) {
    var table = document.createElement('table')
    var head = table.createTHead()
    var headRow = head.insertRow()

    buildRow(data, 'name', function(text) {
      var cell = headRow.insertCell()
      cell.innerText = text
    })

    data.forEach(function(entry) {
      var bodyRow = table.insertRow()
      buildRow(data, entry.text, function(text, idx) {
        var cell = bodyRow.insertCell()
        if (idx === 0) {
          cell.innerText = text
        }
      })
    })

    return table
  }


  DiagramBuilder.render = function(config){
    makeRequest(config.file, function(data) {
      config.elem.innerHTML = ""
      config.elem.appendChild(makeDiagramFrom(data))
    })
  };

  return DiagramBuilder
})(DiagramBuilder || (DiagramBuilder = {}))