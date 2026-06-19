# GANNT

Gannt is a visual way of viewing project tasks in a timeline. Many software products exist that offer gannt, and there are even many open source libraries designed to support creating your own gannt charts.

## The Problem

You want to spend less time selecting a software product that will host your gannt chart, and more time just looking at your project timeline and moving it around. If you're already using/paying for a product like Jira or Monday.com, you're probably taking advantage of cloud based hosting and team collaboration. You probalby also like paying out the nose for features you don't use. 

If you want a super simple gannt chart that doesn't do anything else you may have looked into Miro templates. I also looked into Miro templates, but I couldn't find a good one that was simple and easy to use AND gave me the option of zooming out to quarter years. I found a great template that was good for short projects, but it was super annoying for anything lasting longer than a couple months. 

## This solution

This is actually the 2nd version of this idea to have Claude help build a simple gannt app. In my first attempt I researched various open source libraries designed to assist in building gannt style charts and had Claude use one of those. It had memory leaks and the page would always crash. Before trying to trouble shoot those issues I figured I'd just try asking the AI to roll it's own and the result was a page that looked pretty much the same and didn't crash. Woo, success. 

## Features

There's a script in here that allows you to convert a monday.com task export into the JSON format used by this app. This app has save and open buttons which allow you to write and load .json files with the project config. There is no server/backend, the app just runs in your browser. In browsers that support the File System Access API, the app remembers recent project file handles so you can switch back to saved projects from the dropdown, but the task data itself is not stored in the browser cache.
