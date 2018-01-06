
"use strict";

// you are the last member of a space-faring faction of pioneer settlers
// over the centuries you spent residing in deep orbit, you slowly lost touch with all known contacts
// now new factions have come to your sector of the galaxy
// enemies beseach you from all sides, eager to annex your resources
// only your cunning and your army of loyal robots can save you

const ID = {
    CANVAS: "canvas"
}

const Dungeon = function(entitiesObject) {
    var Entities = entitiesObject
}

const holdout = (function(){

    var canvas, context

    var Entities = {}
    var player = {}
    var view = {
        x:0, y:0, m:1
    }
    
    const quadtree = new Quadtree(800)

    return function() {
        canvas = document.getElementById(ID.CANVAS)
        context = canvas.getContext("2d")
        console.log(canvas,context)

        window.tqt = new Quadtree(1000,3,Entities)

    }

})()

window.onload = holdout
