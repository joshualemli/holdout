
"use strict";

var app = (function(){

    var canvas, context, state

    var Runtime = {}

    var Entities = []

    const enemy = function(type) {

    }
    
    const draw = function() {
        Entities.forEach( entity => {
            context.fillStyle = "#000"
            context.fillRect( entity.x, entity.y, 2, 2 )
        })
    }

    const loop = function() {
        var tNow = new Date().getTime()
        var dt = tNow - Runtime.tPrevious
        Runtime.tPrevious = tNow
        Entities.forEach( entity => {
        })
        draw()
        if (state === "run") window.requestAnimationFrame(draw)
    }

    const Dungeon = (function(){
        var T = {}
        T.ballistic = function(props) {
            this.Ti = props.Ti || new Date().getTime()
            this.Xi = props.Xi || 500
            this.Yi = props.Yi || 0
            this.dx = props.dx || 0
            this.dy = props.dy || 0
        }
        return {
            spawn: function(type,props) {
                if (!T[type]) return null
                var e = new T[type](props)
                Entities.push(e)
            }
        }
    })()

    const canvasClick = function() {
        Dungeon.spawn("ballistic",{dy:10})
    }

    const resizeContext = function() {
        context.canvas.width = canvas.offsetWidth
        context.canvas.height = canvas.offsetHeight
    }

    return function() {
        if (!canvas) {
            canvas = document.getElementById("canvas")
            context = canvas.getContext("2d")
            resizeContext()
            window.addEventListener("resize",resizeContext)
        }
        if (state) console.log("STATE!",state)
        Runtime.tPrevious = new Date().getTime()
        state = "run"
        window.requestAnimationFrame(draw)
    }

})()

window.onload = app
