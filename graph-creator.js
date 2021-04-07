document.onload = (function(d3, saveAs, Blob, undefined){
  "use strict";

  // TODO add user settings
  var consts = {
    defaultTitle: "Node"
  };
  var settings = {
    appendElSpec: "#graph"
  };
  
 
  
  // define graphcreator object
  var GraphCreator = function(svg, nodes, edges, weakEdges){
    
    var thisGraph = this;
        thisGraph.idct = 0;

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];
    thisGraph.weakEdges = weakEdges || [];
   
    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      altNodeDrag: false,
      selectedText: null
    };
	thisGraph.addEdgeClicked = false;
	thisGraph.addWeakEdgeClicked = false;
	thisGraph.drawWeakEdge = false;
	
    // define arrow markers for graph links
    var defs = svg.append('svg:defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "32")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    // define arrow markers for leading arrow
    defs.append('svg:marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg;
    thisGraph.svgG = svg.append("g")
          .classed(thisGraph.consts.graphClass, true);
    var svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('svg:path')
          .attr('class', 'link dragline hidden')
          .attr('d', 'M0,0L0,0')
          .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.weakPaths = svgG.append("g").selectAll("g");
    thisGraph.circles = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
          .origin(function(d){
            return {x: d.x, y: d.y};
          })
          .on("drag", function(args){
            thisGraph.state.justDragged = true;
            thisGraph.dragmove.call(thisGraph, args);
          })
          .on("dragend", function() {
            // todo check if edge-mode is selected
          });

    // listen for key events
    d3.select(window).on("keydown", function(){
      thisGraph.svgKeyDown.call(thisGraph);
    })
    .on("keyup", function(){
      thisGraph.svgKeyUp.call(thisGraph);
    });
    svg.on("mousedown", function(d){thisGraph.svgMouseDown.call(thisGraph, d);});
    svg.on("mouseup", function(d){thisGraph.svgMouseUp.call(thisGraph, d);});

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
          .on("zoom", function(){
            if (d3.event.sourceEvent.shiftKey){
              // TODO  the internal d3 state is still changing
              return false;
            } else{
              thisGraph.zoomed.call(thisGraph);
            }
            return true;
          })
          .on("zoomstart", function(){
            var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
            if (ael){
              ael.blur();
            }
            if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
          })
          .on("zoomend", function(){
            d3.select('body').style("cursor", "auto");
          });

    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function(){thisGraph.updateWindow(svg);};

    // handle download data
    d3.select("#download-input").on("click", function(){
      var saveEdges = [];
      var saveWeakEdges = [];
      thisGraph.edges.forEach(function(val, i){
        saveEdges.push({source: val.source.id, target: val.target.id});
      });
      thisGraph.weakEdges.forEach(function(val, i){
        saveWeakEdges.push({source: val.source.id, target: val.target.id});
      });
      var blob = new Blob([window.JSON.stringify({"nodes": thisGraph.nodes, "edges": saveEdges, "weakEdges": saveWeakEdges})], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "mydag.json");
    });
    
    d3.select("#download-format").on("click", function(){
    	var savePaths = [];
    	var startnodes = [];
    	for (var i = 0; i < thisGraph.nodes.length; i++) {
    	  if (thisGraph.nodes[i].data.type == "start" || thisGraph.nodes[i].data.type == "substart") {
    	  	startnodes.push(thisGraph.nodes[i]);
    	  }
    	}
    	startnodes.forEach(function(val,i){
    		var path = [];
    		var target = thisGraph.traverseEdge(val);
    		var prevTarget = val;
    		do {
    			if (typeof target.data.link != "undefined") {
    				path[path.length-1].link = "weak";
    				delete target.data.link;
    			}
    			path.push(target.data);
    			prevTarget = target;
    			target = thisGraph.traverseEdge(prevTarget);
    		}
    		while (target != null);
    		var d = val.data;
    		d.nodes = path;
    		savePaths.push(d);
    	});
    	var blob = new Blob([window.JSON.stringify({"paths": savePaths})], {type: "text/plain;charset=utf-8"});
      	saveAs(blob, "mypaths.json");
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function(){
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function(){
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function(){
          var txtRes = filereader.result;
          // TODO better error handling
          try{
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes[jsonObj.nodes.length-1].id + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function(e, i){
              newEdges[i] = {source: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0],
                          target: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0]};
            });
            thisGraph.edges = newEdges;
            if(typeof jsonObj.weakEdges !== "undefined")
            {
            var newWeakEdges = jsonObj.weakEdges;
            newWeakEdges.forEach(function(e, i){
              newWeakEdges[i] = {source: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0],
                          target: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0]};
            });
            thisGraph.weakEdges = newWeakEdges;
            }
            thisGraph.updateGraph();
          }catch(err){
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function(){
      thisGraph.deleteGraph(false);
    });
    
    d3.select("#add-node").on("click", function(){
      thisGraph.addNode();
    });
    
    d3.select("#add-startnode").on("click", function(){
      thisGraph.addStartNode();
    });
    
    d3.select("#add-substartnode").on("click", function(){
      thisGraph.addSubStartNode();
    });
    
    d3.select("#add-blocknode").on("click", function(){
      thisGraph.addBlockNode();
    });
    
    d3.select("#add-stacknode").on("click", function(){
      thisGraph.addStackNode();
    });
    
    d3.select("#duplicate-node").on("click", function(){
      thisGraph.duplicateNode();
    });
    
    d3.select("#add-edge").on("click", function(){
      thisGraph.addEdge();
    });
    d3.select("#add-weakedge").on("click", function(){
      thisGraph.addWeakEdge();
    });
    
    d3.select("#delete").on("click", function(){
      thisGraph.delSelected();
    });
    
  };

  GraphCreator.prototype.traverseEdge = function(node){
  	var thisGraph = this;
  	for (var i = 0; i < thisGraph.edges.length; i++)
  	{ 
  		if(thisGraph.edges[i].source.id == node.id)
  		{
  			for (var j = 0; j < thisGraph.nodes.length; j++)
  			{
  				if (thisGraph.nodes[j].id == thisGraph.edges[i].target.id)
  				{
  					return thisGraph.nodes[j];
  				}
  			}
  		}
  	}
  	for (var i = 0; i < thisGraph.weakEdges.length; i++)
  	{ 
  		if(thisGraph.weakEdges[i].source.id == node.id)
  		{
  			for (var j = 0; j < thisGraph.nodes.length; j++)
  			{
  				if (thisGraph.nodes[j].id == thisGraph.weakEdges[i].target.id)
  				{
  					var node = thisGraph.nodes[j];
  					node.data.link = "weak";
  					return node;
  				}
  			}
  		}
  	}
  	return null;
  }

  GraphCreator.prototype.setIdCt = function(idct){
    this.idct = idct;
  };

  GraphCreator.prototype.consts =  {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50
  };

  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag || thisGraph.state.altNodeDrag){
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else{
      d.x += d3.event.dx;
      d.y +=  d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function(skipPrompt){
    var thisGraph = this,
        doDelete = true;
    if (!skipPrompt){
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if(doDelete){
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.weakEdges = [];
      thisGraph.updateGraph();
    }
  };
  
  GraphCreator.prototype.addNode = function(){
  	var thisGraph = this;
  	thisGraph.addTypedNode("generic");
  };
  
  GraphCreator.prototype.addStartNode = function(){
  	var thisGraph = this;
  	thisGraph.addTypedNode("start");
  };
  
  GraphCreator.prototype.addSubStartNode = function(){
  	var thisGraph = this;
  	thisGraph.addTypedNode("substart");
  };
  
  GraphCreator.prototype.addBlockNode = function(){
  	var thisGraph = this;
  	thisGraph.addTypedNode("block");
  };
  
  GraphCreator.prototype.addStackNode = function(){
  	var thisGraph = this;
  	thisGraph.addTypedNode("stack");
  };
 
  GraphCreator.prototype.addTypedNode = function(nodeType){
  	var thisGraph = this;
  	var nodeData = "";
  	if(nodeType == "stack")
  		nodeData = {type:nodeType,count:3};
  	else
  		nodeData = {type:nodeType};
  	var xycoords = d3.mouse(thisGraph.svgG.node()),
          d = {id: thisGraph.idct++, title: consts.defaultTitle, x: xycoords[0]-50+Math.floor(Math.random()*150), y: xycoords[1]-100-Math.floor(Math.random()*150), data: nodeData};
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
      // make title of text immediently editable
      var d3txt = thisGraph.changeTextOfNode(thisGraph.circles.filter(function(dval){
        return dval.id === d.id;
      }), d),
          txtNode = d3txt.node();
      thisGraph.selectElementContents(txtNode);
      txtNode.focus();
  };
  
    GraphCreator.prototype.duplicateNode = function(){
  	var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
	var selectedNode = state.selectedNode;
    d3.event.preventDefault();
    if (selectedNode)
    {
    	console.log(selectedNode);
    	var d = {id: thisGraph.idct++, title: selectedNode.title, x: selectedNode.x+20+Math.floor(Math.random()*80), y: selectedNode.y-20-Math.floor(Math.random()*80), data: selectedNode.data};
    	thisGraph.nodes.push(d);
      	thisGraph.updateGraph();
    }
  };
  
  GraphCreator.prototype.addEdge = function(){
  	var thisGraph = this;
  	if (thisGraph.addEdgeClicked)
  	  thisGraph.addEdgeClicked = false
  	else
  	  thisGraph.addEdgeClicked = true;
  }
  
    GraphCreator.prototype.addWeakEdge = function(){
  	var thisGraph = this;
  	if (thisGraph.addWeakEdgeClicked)
  	  thisGraph.addWeakEdgeClicked = false
  	else
  	  thisGraph.addWeakEdgeClicked = true;
  }
  
    GraphCreator.prototype.delSelected = function(){
  	var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
        var selectedNode = state.selectedNode,
        selectedEdge = state.selectedEdge;
  	d3.event.preventDefault();
      if (selectedNode){
        thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
        thisGraph.spliceLinksForNode(selectedNode);
        thisGraph.spliceWeakLinksForNode(selectedNode);
        state.selectedNode = null;
        thisGraph.updateGraph();
      } else if (selectedEdge){
      	if(selectedEdge.type == 1)
      		thisGraph.weakEdges.splice(thisGraph.weakEdges.indexOf(selectedEdge), 1);
      	else
        	thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
        state.selectedEdge = null;
        thisGraph.updateGraph();
      }
  }

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
    var words = title.split(/\s+/g),
        nwords = words.length;
    var el = gEl.append("text")
          .attr("text-anchor","middle")
          .attr("dy", "-" + (nwords-1)*7.5);

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }
  };


  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function(node) {
    var thisGraph = this,
        toSplice = thisGraph.edges.filter(function(l) {
      return (l.source === node || l.target === node);
    });
    toSplice.map(function(l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };
  
  GraphCreator.prototype.spliceWeakLinksForNode = function(node) {
    var thisGraph = this,
        toSplice = thisGraph.weakEdges.filter(function(l) {
      return (l.source === node || l.target === node);
    });
    toSplice.map(function(l) {
      thisGraph.weakEdges.splice(thisGraph.weakEdges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function(d3Path, edgeData){
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge){
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function(d3Node, nodeData){
    var thisGraph = this;
   
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode){
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;
    editor.set(nodeData.data);
  };

  GraphCreator.prototype.removeSelectFromNode = function(){
    var thisGraph = this;
    thisGraph.circles.filter(function(cd){
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    for (var i = 0, len = thisGraph.nodes.length; i < len; i++) {
      if(thisGraph.nodes[i].id === thisGraph.state.selectedNode.id) {
      	thisGraph.nodes[i].data = editor.get();
      	editor.set(null);
      	thisGraph.updateGraph();
      }
  	}
    thisGraph.state.selectedNode = null;
  };

  GraphCreator.prototype.removeSelectFromEdge = function(){
    var thisGraph = this;
    thisGraph.paths.filter(function(cd){
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function(d3path, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;
    if (state.selectedNode){
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d){

      thisGraph.replaceSelectEdge(d3path, d);
    } else{
      thisGraph.removeSelectFromEdge();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;
    if (d3.event.shiftKey || thisGraph.addEdgeClicked){
    thisGraph.drawWeakEdge = false;
      state.shiftNodeDrag = d3.event.shiftKey || thisGraph.addEdgeClicked;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
    else if (d3.event.altKey || thisGraph.addWeakEdgeClicked){
    	thisGraph.drawWeakEdge = true;
      state.altNodeDrag = d3.event.altKey || thisGraph.addWeakEdgeClicked;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
  };

  /* place editable text on node in place of svg text */
  GraphCreator.prototype.changeTextOfNode = function(d3node, d){
    var thisGraph= this,
        consts = thisGraph.consts,
        htmlEl = d3node.node();
    d3node.selectAll("text").remove();
    var nodeBCR = htmlEl.getBoundingClientRect(),
        curScale = nodeBCR.width/consts.nodeRadius,
        placePad  =  5*curScale,
        useHW = curScale > 1 ? nodeBCR.width*0.71 : consts.nodeRadius*1.42;
    // replace with editableconent text
    var d3txt = thisGraph.svg.selectAll("foreignObject")
          .data([d])
          .enter()
          .append("foreignObject")
          .attr("x", nodeBCR.left + placePad )
          .attr("y", nodeBCR.top + placePad)
          .attr("height", 2*useHW)
          .attr("width", useHW)
          .append("xhtml:p")
          .attr("id", consts.activeEditId)
          .attr("contentEditable", "true")
          .text(d.title)
          .on("mousedown", function(d){
            d3.event.stopPropagation();
          })
          .on("keydown", function(d){
            d3.event.stopPropagation();
            if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
              this.blur();
            }
          })
          .on("blur", function(d){
            d.title = this.textContent;
            thisGraph.insertTitleLinebreaks(d3node, d.title);
            d3.select(this.parentElement).remove();
          });
    return d3txt;
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    state.altNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d){
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {source: mouseDownNode, target: d};
      if (thisGraph.drawWeakEdge) {
      		newEdge.type=1;
      	 var filtRes = thisGraph.paths.filter(function(d){
        if (d.source === newEdge.target && d.target === newEdge.source){
          thisGraph.edges.splice(thisGraph.weakEdges.indexOf(d), 1);
        }
        return d.source === newEdge.source && d.target === newEdge.target;
      });
      if (!filtRes[0].length){
        thisGraph.weakEdges.push(newEdge);
        thisGraph.updateGraph();
        this.addWeakEdgeClicked = false;
      }
      }
      else
      {
          newEdge.type=0;
      var filtRes = thisGraph.paths.filter(function(d){
        if (d.source === newEdge.target && d.target === newEdge.source){
          thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
        }
        return d.source === newEdge.source && d.target === newEdge.target;
      });
      if (!filtRes[0].length){
        thisGraph.edges.push(newEdge);
        thisGraph.updateGraph();
        this.addEdgeClicked = false;
      }
      }
    } else{
      // we're in the same node
      if (state.justDragged) {
        // dragged, not clicked
        state.justDragged = false;
      } else{
        // clicked, not dragged
        if (d3.event.shiftKey){
          // shift-clicked node: edit text content
          var d3txt = thisGraph.changeTextOfNode(d3node, d);
          var txtNode = d3txt.node();
          thisGraph.selectElementContents(txtNode);
          txtNode.focus();
        } else{
          if (state.selectedEdge){
            thisGraph.removeSelectFromEdge();
          }
          var prevNode = state.selectedNode;

          if (!prevNode || prevNode.id !== d.id){
            thisGraph.replaceSelectNode(d3node, d);
          } else{
            thisGraph.removeSelectFromNode();
          }
        }
      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function(){
    this.state.graphMouseDown = true;
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function(){
    var thisGraph = this,
        state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey){
      // clicked not dragged from svg
      var xycoords = d3.mouse(thisGraph.svgG.node()),
          d = {id: thisGraph.idct++, title: consts.defaultTitle, x: xycoords[0], y: xycoords[1], data: {type:"generic"}};
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
      // make title of text immediently editable
      var d3txt = thisGraph.changeTextOfNode(thisGraph.circles.filter(function(dval){
        return dval.id === d.id;
      }), d),
          txtNode = d3txt.node();
      thisGraph.selectElementContents(txtNode);
      txtNode.focus();
    } else if (state.shiftNodeDrag || state.altNodeDrag){
      // dragged from node
      state.shiftNodeDrag = false;
      state.altNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function() {
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if(state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
        selectedEdge = state.selectedEdge;

    switch(d3.event.keyCode) {
    case consts.DELETE_KEY:
      d3.event.preventDefault();
      if (selectedNode){
        thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
        thisGraph.spliceLinksForNode(selectedNode);
        thisGraph.spliceWeakLinksForNode(selectedNode);
        state.selectedNode = null;
        thisGraph.updateGraph();
      } else if (selectedEdge){
      	console.log(selectedEdge);
      	if(selectedEdge.type == 1)
      		thisGraph.weakEdges.splice(thisGraph.weakEdges.indexOf(selectedEdge), 1);
      	else
        	thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
        
        state.selectedEdge = null;
        thisGraph.updateGraph();
      }
      break;
    }
  };

  GraphCreator.prototype.svgKeyUp = function() {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function(){

    var thisGraph = this,
        consts = thisGraph.consts,
        state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function(d){
      return String(d.source.id) + "+" + String(d.target.id);
    });

    var paths = thisGraph.paths;
    // update existing paths
    paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      .attr("d", function(d){
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end','url(#end-arrow)')
      .classed("link", true)
      .attr("d", function(d){
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function(d){
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
        }
      )
      .on("mouseup", function(d){
        state.mouseDownLink = null;
      });

    // remove old links
    paths.exit().remove();

    thisGraph.weakPaths = thisGraph.weakPaths.data(thisGraph.weakEdges, function(d){
      return String(d.source.id) + "+" + String(d.target.id);
    });

    var weakPaths = thisGraph.weakPaths;
    // update existing paths
    weakPaths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      .attr("d", function(d){
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      });

    // add new paths
    weakPaths.enter()
      .append("path")
      .style('marker-end','url(#end-arrow)')
      .classed("weaklink", true)
      .attr("d", function(d){
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function(d){
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
        }
      )
      .on("mouseup", function(d){
        state.mouseDownLink = null;
      });

    // remove old links
    weakPaths.exit().remove();

    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function(d){ return d.id;});
    thisGraph.circles.attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";});
	thisGraph.circles.each(function(d){
		var circleselect = d3.selectAll("circle").filter(function(dval){return dval.id === d.id;});
		if(d.data.type=="block") {
			circleselect.style("stroke","OrangeRed");
			circleselect.style("stroke-width","6px");
			circleselect.style("stroke-dasharray","7,1");
		}
		if(d.data.type=="start") {
			circleselect.style("stroke","SeaGreen");
			circleselect.style("stroke-width","6px");
			circleselect.style("stroke-dasharray","7,1");
		}
		if(d.data.type=="substart") {
			circleselect.style("stroke","SteelBlue");
			circleselect.style("stroke-width","3px");
			circleselect.style("stroke-dasharray","7,1");
		}
		if(d.data.type=="stack") {
			circleselect.style("stroke","SlateGray");
			circleselect.style("stroke-width","6px");
		}
		if(d.data.type=="reward") {
			circleselect.style("stroke","GoldenRod");
			circleselect.style("stroke-width","6px");
		}
		
	});
    // add new nodes
    if(thisGraph.nodes.length > 0)
    {
    var newGs= thisGraph.circles.enter()
          .append("g");

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";})
      .on("mouseover", function(d){
        if (state.shiftNodeDrag || state.altNodeDrag){
          d3.select(this).classed(consts.connectClass, true);
        }
      })
      .on("mouseout", function(d){
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function(d){
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function(d){
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      .call(thisGraph.drag);

    newGs.append("circle")
      .attr("r", String(consts.nodeRadius));

	newGs.each(function(d){
		var circleselect = d3.selectAll("circle").filter(function(dval){return dval.id === d.id;});
		if(d.data.type=="block") {
			circleselect.style("stroke","OrangeRed");
			circleselect.style("stroke-width","6px");
			circleselect.style("stroke-dasharray","7,1");
		}
		if(d.data.type=="start") {
			circleselect.style("stroke","SeaGreen");
			circleselect.style("stroke-width","6px");
			circleselect.style("stroke-dasharray","7,1");
		}
		if(d.data.type=="substart") {
			circleselect.style("stroke","SteelBlue");
			circleselect.style("stroke-width","3px");
			circleselect.style("stroke-dasharray","7,1");
		}
		if(d.data.type=="stack") {
			circleselect.style("stroke","SlateGray");
			circleselect.style("stroke-width","6px");
		}
		if(d.data.type=="reward") {
			circleselect.style("stroke","GoldenRod");
			circleselect.style("stroke-width","6px");
		}
		
	});

    newGs.each(function(d){
      thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
    });
	}
    // remove old nodes
    thisGraph.circles.exit().remove();
  };

  GraphCreator.prototype.zoomed = function(){
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  };

  GraphCreator.prototype.updateWindow = function(svg){
    var docEl = document.documentElement,
        bodyEl = document.getElementsByTagName('body')[0],
      	containerEl = document.getElementById('graph');
    var x = containerEl.offsetWidth;
    var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };



  /**** MAIN ****/

  // warn the user when leaving
  window.onbeforeunload = function(){
    return "Make sure to save your graph locally before leaving :-)";
  };

  var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0],
      containerEl = document.getElementById('graph');

  var width = containerEl.offsetWidth,
      height =  window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;

  var xLoc = width/2 - 25,
      yLoc = 100;

  // initial node data
  var nodes = [];
  var edges = [];
  var weakEdges = [];


  /** MAIN SVG **/
  var svg = d3.select(settings.appendElSpec).append("svg")
        .attr("width", width)
        .attr("height", height);
  var graph = new GraphCreator(svg, nodes, edges, weakEdges);
      graph.setIdCt(2);
  graph.updateGraph();
})(window.d3, window.saveAs, window.Blob);
