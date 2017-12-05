
"use strict";

const app = (function(){

    var canvas, context

    const safeChars = str => str.replace(/[^a-zA-Z0-9]/g,"")

    const normalizeVector = (v,l) => { // v = original vector, l = normalized length
        let dX = v[0], dY = v[1]
        let dD = Math.sqrt( dX*dX + dY*dY )
        return [dX/dD * l, dY/dD * l]
    }

    var Env = {}

    var Player = {
        resources: {
            unrefinedOre: 0,
            processedOre: 0,
            preciousMinerals: 0
        },
        kills: {},
        updateKills: type => {
            var safeCharsType = safeChars(type)
            Player.kills[safeCharsType] += 1
            var e = document.getElementById("kills-item-"+safeCharsType)
            if (!e) {
                e = document.createElement("div")
                e.innerHTML = `<span style="width:20em">${type}</span> ... <span id="kills-item-${safeCharsType}">1</span>`
                document.getElementById("kills").appendChild(e)
            }
            else e.innerHTML = Player.kills[safeCharsType]
        }
    }
window.pk = Player
    var Entities = []
    var EntityGroups
    const resetEntityGroups = () => EntityGroups = {
        playerWeapons: []
    }

    var Effects = []
    var EffectBook = {}
    EffectBook.impact = function(props) {
        this.x = props.x;
        this.y = props.y;
        this.rMax = props.r
        this.r = props.r * 0.05
        this.lifespan = props.lifespan || 1000
        this.tCreated = new Date().getTime()
    }
    EffectBook.impact.prototype.stepAndDraw = function(dt,index) {
        context.strokeStyle = "#FFFFFF"
        context.lineWidth = 1
        context.beginPath()
        context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
        context.stroke()
        this.r += this.rMax * 0.05 * dt
        if (this.r > this.rMax) this.r = 0.05 * this.rMax
        if (Env.tGameplay - this.tCreated > this.lifespan) this.DEAD = true
    }
    const spawnEffect = (type,props) => Effects[Effects.push(new EffectBook[type](props)) - 1]


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

        var i

        // get time step
        var tNow = new Date().getTime()
        var dt = tNow - Env.tGameplay
        if (dt > 40) console.log(dt + "ms elapsed between frames!")
        Env.tGameplay = tNow

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
                if (A.injure && B.damage) {
                    A.injure(B.damage())
                    if (A.DEAD && B.owner==="player") Player.updateKills(A.type)
                }
                if (B.injure && A.damage) {
                    B.injure(A.damage())
                    if (B.DEAD && A.owner==="player") Player.updateKills(B.type)
                }
            }
        }

        // handle user input
        UserInput.handle()
        
        // remove dead entities
        for (i = Entities.length; i--;) if (Entities[i].DEAD) {
            if (Entities[i].die) Entities[i].die()
            Entities.splice(i,1)
        }

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
        Effects.forEach( (effect,index) => effect.stepAndDraw(dtGame,index) )
        for (i = Effects.length; i--;) if (Effects[i].DEAD) Effects.splice(i,1)
        
        // handle world randomization and progress
        if (Math.random() > 0.95) Dungeon.spawn("massDriver",{})
        if (Math.random() > 0.91) Dungeon.spawn("weaponizedMeteorite",{})

        //debug :: time frame
        // if(Math.random() > 0.95) console.log(new Date().getTime() - tNow)

        // loop
        if (Env.state === "gameplay") window.requestAnimationFrame(gameplayLoop)

    }

    const Dungeon = (function(){

        var T = {}

        const _setLevel = function(level,callback) {
            var dir = level - this.level > 0 ? 1 : -1
            while (this.level !== level) callback(dir)
        }

        const BaseEntity = function(props) {
            this.level = 1
            this.owner = props.owner
            this.tCreated = new Date().getTime()
            this.x = props.x
            this.y = props.y
            this.r = props.r
            if (props.level && this.setLevel) this.setLevel(props.level)
        }

        T.plasmaGun = function(props) {
            props.r = 7
            BaseEntity.call(this,props)
            this.cooldown = 225
            this.lastFired = 0
            this.colorCycleIndex = 0
            this.colorCycleWheel = [
                [255,0,0],
                [255,128,0],
                [255,255,0],
                [128,255,0],
                [0,255,128],
                [0,255,255],
                [0,128,255],
                [0,0,255]
            ]
        }
        T.plasmaGun.prototype.type = "Plasma Gun"
        T.plasmaGun.prototype.setLevel = function(level) {
            _setLevel.call(this, level, dir => {
                this.level += dir
                this.cooldown += dir * -0.01 * this.cooldown
            })
        }
        T.plasmaGun.prototype.step = function(dt,index) {
            EntityGroups.playerWeapons.push(index)
        }
        T.plasmaGun.prototype.draw = function(){
            context.fillStyle = "#FF00FF"
            context.fillRect(this.x-this.r, this.y-this.r, this.r*2, this.r*2)
        }
        T.plasmaGun.prototype.injure = function(damage) {
            let area = this.r*this.r*Math.PI - damage
            if (area <= 25) this.DEAD = true
            else this.r = Math.sqrt(area/Math.PI)
        }
        T.plasmaGun.prototype.fire = function(t,worldPosArr) {
            if (t - this.lastFired >= this.cooldown) {
                Dungeon.spawn("plasma",{
                    color: this.colorCycleWheel[this.colorCycleIndex++],
                    owner: this.owner,
                    vector: worldPosArr,
                    x: this.x,
                    y: this.y + this.r + 3,
                    level: this.level
                })
                if (this.colorCycleIndex === this.colorCycleWheel.length) this.colorCycleIndex = 0
                this.lastFired = t
            }
        }

        T.plasma = function(props) {
            props.r = 1.2 + 0.07 * props.level
            BaseEntity.call(this,props)
            this.trailLength = this.r * 5
            this.color = props.color
            this.speed = 1.5 + 0.2 * props.level
            this.lifespan = 2000 + 200 * props.level
            let dX = props.vector[0] - this.x
            let dY = props.vector[1] - this.y
            let normVec = normalizeVector([dX,dY], this.speed)
            this.dx = normVec[0]
            this.dy = normVec[1]
            let addVec = normalizeVector([dX,dY], this.trailLength)
            this.xLengthAdd = addVec[0]
            this.yLengthAdd = addVec[1]
        }
        T.plasma.prototype.type = "Plasma"
        T.plasma.prototype.draw = function() {
            context.strokeStyle = "rgb("+this.color.join(",")+")"
            context.lineWidth = this.r
            context.beginPath()
            context.moveTo(this.x,this.y)
            context.lineTo(this.x-this.xLengthAdd,this.y-this.yLengthAdd)
            context.stroke()
        }
        T.plasma.prototype.step = function(dt,index) {
            if (Env.tGameplay - this.tCreated > this.lifespan) this.DEAD = true
            this.x += this.dx
            this.y += this.dy
        }
        T.plasma.prototype.damage = function() {
            this.DEAD = true
            return 4 * this.r * this.speed
        }

        T.massDriver = function(props) {
            this.r = props.r || 6
            this.dx = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 0.1
            this.dy = -0.8
            this.x = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 300
            this.y = 1600
        }
        T.massDriver.prototype.type = "Mass Driver"
        T.massDriver.prototype.draw = function() {
            context.fillStyle = "#FFD700"
            context.beginPath()
            context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
            context.fill()
        }
        T.massDriver.prototype.step = function(dt,index) {
            this.x += this.dx * dt
            this.y += this.dy * dt
            if (this.y < 0) this.DEAD = true
        }
        T.massDriver.prototype.injure = function(damage) {
            let area = this.r*this.r*Math.PI - damage
            if (area < 2) this.DEAD = true
            else this.r = Math.sqrt(area/Math.PI)
        }
        T.massDriver.prototype.damage = function() {
            this.DEAD = true
            return this.r * this.r * 2.5
        }
        T.massDriver.prototype.die = function() {
            spawnEffect("impact", {x:this.x, y:this.y, r:this.r*3.5, lifespan: 500})
        }

        T.weaponizedMeteorite = function() {
            this.r = 3
            this.dx = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 0.1
            this.dy = -1.3
            this.x = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 300
            this.y = 1600
        }
        T.weaponizedMeteorite.prototype.type = "Weaponized Meteorite"
        T.weaponizedMeteorite.prototype.step = function(dt,index) {
            this.x += this.dx * dt
            this.y += this.dy * dt
            if (this.y < 0) this.DEAD = true
        }
        T.weaponizedMeteorite.prototype.draw = function() {
            context.fillStyle = "#C0C0C0"
            context.beginPath()
            context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
            context.fill()
        }
        T.weaponizedMeteorite.prototype.injure = function() {
            this.DEAD = true
        }
        T.weaponizedMeteorite.prototype.damage = function() {
            this.DEAD = true
            return Math.random()*13
        }
        T.weaponizedMeteorite.prototype.die = function() {
            spawnEffect("impact", {x:this.x, y:this.y, r:1.5*this.r, lifespan:350})
        }

        for (var _type in T) Player.kills[safeChars(T[_type].prototype.type)] = 0

        return {
            spawn: function(type,props) {
                if (!T[type]) throw new Error("invalid type")
                var e = new T[type](props)
                Entities.push(e)
                return e
            }
        }
    })()

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
                            EntityGroups.playerWeapons.forEach( wIndex => Entities[wIndex].fire(Env.tGameplay,worldClickPos) )
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
        Env.tGameplay = new Date().getTime()

        // debug :: create a weapon?
        Dungeon.spawn("plasmaGun",{x:-300,y:0,owner:"player"}).setLevel(5)
        Dungeon.spawn("plasmaGun",{x:0,y:0,owner:"player"}).setLevel(10)
        Dungeon.spawn("plasmaGun",{x:300,y:0,owner:"player"}).setLevel(20)

        window.requestAnimationFrame(gameplayLoop)
    }

})()

window.onload = app
