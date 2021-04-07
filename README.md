json-dgc
======================

Interactive tool for creating directed graphs with custom JSON data in each node, created using d3.js and jsoneditor.

<p align="center">
<img src="http://obphio.us/media/images/digraph-creator.png" alt="Metacademy Logo" height="350px"/>
</p>

Operation:

* drag/scroll to translate/zoom the graph
* shift-click on graph to create a node
* shift-click on a node and then drag to another node to connect them with a directed edge
* shift-click on a node to change its title
* click on node or edge and press backspace/delete to delete
* use editor on right-hand side to enter custom data to nodes, switching selection saves data to node

Run:

* npm install jsoneditor
* `python -m SimpleHTTPServer 8000`
* navigate to http://127.0.0.1:8000

Github repo is at https://github.com/eimink/json-dgc/

License: MIT/X







