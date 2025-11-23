# georgejames.config-explorer

This VS Code extension leverages [Structurizr Lite](https://docs.structurizr.com/lite) to produce configuration diagrams for your InterSystems servers.

## Getting Started

> Docker Engine is required in the environment where the extension runs, which is usually your workstation. This is what hosts Structurizr Lite.

1. Install the extension. This will also install the InterSystems Server Manager extension if you don't already have it.

2. Use [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager)'s view to find a server, or to add a server definition.

> By default, servers run their superserver on port 1972. If any of your servers use a different port you must set this on the `port` property of the `superServer` object of your server definition. Do this by editing the JSON of your settings.

3. On the chosen server in the tree, click the button whose hover text is 'Explore Configuration'.

> The first request for configuration diagrams in a VS Code session will produce a progress notification in the lower right corner while Structurizr Lite is started. This may take up to 45 seconds.

4. The diagrams are displayed in your default web browser at a URL of the format `http://localhost:NNNN/workspace/diagrams` where `NNNN` is the free local port mapped to a web server running inside the Structurizr Lite container. This page may take a little while to load when first used.

> Each time you click an 'Explore Configuration' button a new tab opens in your browser. To avoid confusion we recommend you close the previously-opened tab, because interacting with it will now display the diagrams for the most recently explored server in place of those of the original one.

## Release Notes

See the [CHANGELOG](CHANGELOG.md) for changes in each release.

## Known Issues
None.

## Plans
1. Diagrams for more configuration components.
2. Hide preconfigured entities such as IRIS* and ENS* databases and namespaces.

## Feedback

Please use https://github.com/gjsjohnmurray/gjConfigExplorer/issues to report bugs and suggest improvements.

## About George James Software

Known for our expertise in InterSystems technologies, George James Software has been providing innovative software solutions for over 35 years. We focus on activities that can help our customers with the support and maintenance of their systems and applications. Our activities include consulting, training, support, and developer tools - with Deltanji source control being our flagship tool. Our tools augment InterSystems' technology and can help customers with the maintainability and supportability of their applications over the long term. 

To find out more, go to our website - [georgejames.com](https://georgejames.com) 
