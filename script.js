
"use strict";

const app = (function(){

    var canvas, context

    var Env = {}

    var Entities = []

    const Viewport = (function(){
        var scale = 1 // scale FACTOR e.g. `size_on_screen = size*scale`
        var pos = { x:0, y:0 }
        return {
            init() { pos.x=0; pos.y=context.canvas.height/2; scale=1; },
            zoom(factor) { scale *= factor },
            move(axis,amount) { pos[axis] += amount*5 },
            scale: ()=>scale,
            x: ()=>pos.x,
            y: ()=>pos.y,
            setAll(x,y,s) { pos.x=x; pos.y=y; scale=s },
            clientToWorld(cX,cY){
                return [
                    // functions can be reduced! left this way for clarity (for now)
                    pos.x - (context.canvas.width/scale/2) + (cX/scale),
                    pos.y + (context.canvas.height/scale/2) - (cY/scale)
                ]
            }
        }
    })()

    const gameplayLoop = function() {
        // get time step
        var tNow = new Date().getTime()
        var dt = tNow - Env.tPrevious
        if (dt > 50) throw new Error(dt + "ms elapsed between frames!")
        Env.tPrevious = tNow
        // step world actions
        Entities.forEach( entity => entity.step(dt) )
        // clear canvas
        context.setTransform(1,0,0,1,0,0)
        context.clearRect(0,0,context.canvas.width,context.canvas.height)
        // set transform and draw
        context.setTransform(
            1*Viewport.scale(),
            0,0,
            -1*Viewport.scale(),
            context.canvas.width/2 - Viewport.x()*Viewport.scale(),
            context.canvas.height/2 + Viewport.y()*Viewport.scale()
        )
        Entities.forEach( entity => entity.draw() )
        //debug
        context.fillStyle="#FF00FF"
        context.fillRect(-2,-2,4,4)
        inputHandler()
        if (Env.state === "gameplay") window.requestAnimationFrame(gameplayLoop)
    }

    const Dungeon = (function(){

        var T = {}

        T.plasma = function(props) {
            if (!props.vector) throw new Error("must supply `vector` in constructor params")
            let speed = 2
            let _vx = props.vector[0]
            let _vy = props.vector[1]
            let _vs = Math.sqrt( _vx*_vx + _vy*_vy )
            this.dx = _vx / _vs * speed
            this.dy = _vy / _vs * speed
            this.Ti = props.Ti || new Date().getTime()
            this.x = props.Xi || 0
            this.y = props.Yi || 0
            this.color = props.color || [200,0,0]
            this.width = props.width || 1
            this.xLengthAdd = _vx / _vs * (props.boltLength || 7)
            this.yLengthAdd = _vy / _vs * (props.boltLength || 7)
        }
        T.plasma.prototype.draw = function() {
            context.strokeStyle = "rgb("+this.color.join(",")+")"
            context.lineWidth = this.width
            context.beginPath()
            context.moveTo(this.x,this.y)
            context.lineTo(this.x-this.xLengthAdd,this.y-this.yLengthAdd)
            context.stroke()
        }
        T.plasma.prototype.step = function(dt) {
            this.x += this.dx * dt/16
            this.y += this.dy * dt/16
        }

        return {
            spawn: function(type,props) {
                if (!T[type]) throw new Error("invalid type")
                var e = new T[type](props)
                Entities.push(e)
            }
        }
    })()

    const canvasClick = function(event) {
        console.log(Viewport.clientToWorld(event.clientX,event.clientY))
        Dungeon.spawn("plasma",{
            vector: Viewport.clientToWorld(event.clientX,event.clientY)
            // vector: [ event.clientX - context.canvas.width/2 , context.canvas.height - event.clientY ]
        })
    }

    const resizeContext = function() {
        context.canvas.width = canvas.offsetWidth
        context.canvas.height = canvas.offsetHeight
    }

    const inputHandler = (function(){
        const inputAction = {
            gameplay: {
                "="(){Viewport.zoom(1.01)},
                "-"(){Viewport.zoom(0.99)},
                "ArrowUp"(){Viewport.move("y",1)},
                "ArrowDown"(){Viewport.move("y",-1)},
                "ArrowLeft"(){Viewport.move("x",-1)},
                "ArrowRight"(){Viewport.move("x",1)},
                "0"(){Viewport.setAll(0,0,1)}
                //"0":Viewport.init
            }
        }
        var KeyMap = {}
        window.addEventListener("keydown", event => KeyMap[event.key] = true )
        window.addEventListener("keyup", event => KeyMap[event.key] = false )
        return function() {
            for (var key in KeyMap) if (KeyMap[key] && inputAction[Env.state][key]) inputAction[Env.state][key]()
        }
    })()

    return function() {
        if (!Env._READY) {
            canvas = document.getElementById("canvas")
            context = canvas.getContext("2d")
            resizeContext()
            window.addEventListener("resize",resizeContext)
            canvas.addEventListener("click",canvasClick)
            inputHandler()
            Viewport.init()
            Env._READY = true
        }
        if (Env.state) console.log("Env.state!",Env.state)
        Env.state = "gameplay"
        Env.tPrevious = new Date().getTime()
        window.requestAnimationFrame(gameplayLoop)
    }

})()

window.onload = app
