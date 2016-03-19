'use strict';

var DiagramBuilder
(function (DiagramBuilder) {

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

  function makeDiagramFrom(data) {
    var root = document.createElement('pre')
    root.innerText = JSON.stringify(data)
    return root
  }


  DiagramBuilder.render = function(config){
    makeRequest(config.file, function(data) {
      config.elem.innerHTML = ""
      config.elem.appendChild(makeDiagramFrom(data))
    })
  };

  return DiagramBuilder
})(DiagramBuilder || (DiagramBuilder = {}))