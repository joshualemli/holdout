
"use strict";

const app = (function(){

    var canvas, context

    var Env = {}

    var Entities = []
    var EntityGroups
    const resetEntityGroups = () => EntityGroups = {
        playerWeapons: []
    }

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
                    pos.x - (context.canvas.width/scale/2) + (cX/scale),
                    pos.y + (context.canvas.height/scale/2) - (cY/scale)
                ]
            }
        }
    })()

    const Spatial = (function(){
        const EDGE = 20
        const hash = n => Math.floor(n/EDGE)
        const test = (iA,iB) => {
            let eA = Entities[iA]
            let eB = Entities[iB]
            let rA = eA.r || 1
            let rB = eB.r || 1
            let dx = eA.x - eB.x
            let dy = eA.y - eB.y
            return Math.sqrt(dx*dx+dy*dy) - rA - rB <= 0
        }
        var bin = {}
        return {
            add(x,y,entityIndex){
                x = hash(x)
                y = hash(y)
                if (bin[x]) {
                    if (bin[x][y]) bin[x][y].push(entityIndex)
                    else bin[x][y] = [entityIndex]
                }
                else {
                    bin[x] = {}
                    bin[x][y] = [entityIndex]
                }
            },
            runHitTest(){
                var couplets = {}
                var neighborsIndex
                for (var x in bin) for (var y in bin[x]) {
                    neighborsIndex = []
                    for (var xAdd=-1; xAdd<2; xAdd+=1) {
                        var _addX = parseInt(x) + xAdd
                        if (bin[_addX]) for (var yAdd=-1; yAdd<2; yAdd+=1) {
                            var _addY = parseInt(y) + yAdd
                            if (bin[_addX][_addY]) bin[_addX][_addY].forEach( nI => neighborsIndex.push(nI) )
                        }
                    }
                    bin[x][y].forEach( index => {
                        neighborsIndex.forEach( nI => {
                            if (nI !== index) {
                                var lowIndex = Math.min(nI,index)
                                var highIndex = Math.max(nI,index)
                                if (couplets[lowIndex]) {
                                    if (couplets[lowIndex][highIndex] === undefined) couplets[lowIndex][highIndex] = test(lowIndex,highIndex)
                                }
                                else {
                                    couplets[lowIndex] = {}
                                    couplets[lowIndex][highIndex] = test(lowIndex,highIndex)
                                }
                            }
                        })
                    })
                }
                // reset for next use
                bin = {}
                // return result
                return couplets
            }
        }
    })()

    const gameplayLoop = function() {

        // get time step
        var tNow = new Date().getTime()
        var dt = tNow - Env.tPrevious
        if (dt > 40) console.log(dt + "ms elapsed between frames!")
        Env.tPrevious = tNow

        // step world actions
        resetEntityGroups()
        var dtGame = dt/16
        Entities.forEach( (entity,index) => {
            entity.step(dtGame,index)
            Spatial.add(entity.x,entity.y,index)
        })
        var couplets = Spatial.runHitTest()
        if (Object.keys(couplets).length) {
            for (var aI in couplets) for (var bI in couplets[aI]) if (couplets[aI][bI]) {
                var A = Entities[aI]
                var B = Entities[bI]
                if (A.injure && B.damage) A.injure(B.damage())
                if (B.injure && A.damage) B.injure(A.damage())
            }
        }
        for (var _ei = Entities.length; _ei--;) if (Entities[_ei].DEAD) Entities.splice(_ei,1)
        // collision test and handle actions
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

        // handle user input
        UserInput.handle()

        // handle world randomization and progress
        if (Math.random() > 0.99) Dungeon.spawn("massDriver",{})

        //debug :: time frame
        //if(Math.random() > 0.95) console.log(new Date().getTime() - tNow)

        // loop
        if (Env.state === "gameplay") window.requestAnimationFrame(gameplayLoop)

    }

    const Dungeon = (function(){

        var T = {}

        T.plasmaGun = function(props) {
            this.cooldown = props.cooldown || 300
            this.lastFired = 0
            this.x = props.x
            this.y = props.y
            this.r = 3
        }
        T.plasmaGun.prototype.step = function(dt,index) {
            EntityGroups.playerWeapons.push(index)
        }
        T.plasmaGun.prototype.draw = function(){
            context.fillStyle = "#FF00FF"
            context.fillRect(this.x-this.r, this.y-this.r, this.r*2, this.r*2)
        }
        T.plasmaGun.prototype.fire = function(t,worldPosArr) {
            if (t - this.lastFired >= this.cooldown) {
                Dungeon.spawn("plasma",{
                    vector: worldPosArr,
                    x:this.x,
                    y:this.y + this.r + 1
                })
                this.lastFired = t
            }
        }

        T.plasma = function(props) {
            this.x = props.x || 0
            this.y = props.y || 0
            this.speed = 2
            let _vx = props.vector[0] - this.x
            let _vy = props.vector[1] - this.y
            let _vs = Math.sqrt( _vx*_vx + _vy*_vy )
            this.dx = _vx / _vs * this.speed
            this.dy = _vy / _vs * this.speed
            this.Ti = props.Ti || new Date().getTime()
            this.color = props.color || [200,0,0]
            this.boltWidth = props.boltWidth || 2
            this.boltLength = props.boltLength || 7
            this.xLengthAdd = _vx / _vs * this.boltLength
            this.yLengthAdd = _vy / _vs * this.boltLength
            this.level = props.level || 1
        }
        T.plasma.prototype.draw = function() {
            context.strokeStyle = "rgb("+this.color.join(",")+")"
            context.lineWidth = this.boltWidth
            context.beginPath()
            context.moveTo(this.x,this.y)
            context.lineTo(this.x-this.xLengthAdd,this.y-this.yLengthAdd)
            context.stroke()
        }
        T.plasma.prototype.step = function(dt,index) {
            if (Env.tPrevious - this.Ti > 5000) this.DEAD = true
            this.x += this.dx
            this.y += this.dy
        }
        T.plasma.prototype.damage = function() {
            return this.boltWidth * this.boltLength / this.speed * this.level
        }

        T.massDriver = function(props) {
            this.r = props.r || 6
            this.dx = (Math.random() > 0.5 ? -1 : 1) * Math.random()
            this.dy = -0.8
            this.x = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 500
            this.y = 800
        }
        T.massDriver.prototype.draw = function() {
            context.beginPath()
            context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
            context.fill()
        }
        T.massDriver.prototype.step = function(dt,index) {
            this.x += this.dx * dt
            this.y += this.dy * dt
            if (this.y < 50) this.DEAD = true
        }
        T.massDriver.prototype.injure = function(damage) {
            let area = this.r*this.r*Math.PI - damage
            if (area <= 0) this.DEAD = true
            else this.r = Math.sqrt(area/Math.PI)
        }

        return {
            spawn: function(type,props) {
                if (!T[type]) throw new Error("invalid type")
                var e = new T[type](props)
                Entities.push(e)
            }
        }
    })()

    // const canvasClick = function(event) {
    //     Dungeon.spawn("plasma",{
    //         vector: Viewport.clientToWorld(event.clientX,event.clientY)
    //     })
    // }

    const resizeContext = function() {
        context.canvas.width = canvas.offsetWidth
        context.canvas.height = canvas.offsetHeight
    }

    const UserInput = (function(){
        var worldClickPos
        const inputAction = {
            gameplay: {
                "="(){Viewport.zoom(1.01)},
                "-"(){Viewport.zoom(0.99)},
                "ArrowUp"(){Viewport.move("y",1)},
                "ArrowDown"(){Viewport.move("y",-1)},
                "ArrowLeft"(){Viewport.move("x",-1)},
                "ArrowRight"(){Viewport.move("x",1)},
                "0"(){Viewport.setAll(0,0,1)},
                "mouse"(){
                    switch(Env.mouseAction) {
                        case "fire":
                            EntityGroups.playerWeapons.forEach( wIndex => Entities[wIndex].fire(Env.tPrevious,worldClickPos) )
                            break
                        default: throw new Error("no mouse action set")
                    }
                }
            }
        }
        var KeyMap = {}
        return {
            init() {
                window.addEventListener("keydown", event => KeyMap[event.key] = true )
                window.addEventListener("keyup", event => KeyMap[event.key] = false )
                canvas.addEventListener("mousemove", event => worldClickPos = Viewport.clientToWorld(event.clientX,event.clientY) )
                canvas.addEventListener("mousedown", event => KeyMap.mouse = true )
                canvas.addEventListener("mouseup", event => KeyMap.mouse = false )
            },
            handle() {
                for (var key in KeyMap) if (KeyMap[key] && inputAction[Env.state][key]) inputAction[Env.state][key]()
            }
        }
    })()

    return function() {
        if (!Env._READY) {
            canvas = document.getElementById("canvas")
            context = canvas.getContext("2d")
            resizeContext()
            window.addEventListener("resize",resizeContext)
            // canvas.addEventListener("click",canvasClick)
            UserInput.init()
            Viewport.init()
            Env._READY = true
        }
        if (Env.state) console.log("Env.state!",Env.state)
        Env.mouseAction = "fire"
        Env.state = "gameplay"
        Env.tPrevious = new Date().getTime()

        // debug :: create a weapon?
        Dungeon.spawn("plasmaGun",{x:0,y:0})

        window.requestAnimationFrame(gameplayLoop)
    }

})()

window.onload = app
